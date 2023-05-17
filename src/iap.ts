import {NativeModules, Platform} from 'react-native';

import * as IapIos from './modules/ios';
import * as IapIosSk2 from './modules/iosSk2';
import {offerToRecord} from './types/apple';
import {
  offerSk2Map,
  ProductSk2,
  productSk2Map,
  subscriptionSk2Map,
  transactionSk2ToPurchaseMap,
} from './types/appleSk2';
import {
  getIosModule,
  getNativeModule,
  isIosStorekit2,
  storekit1Mode,
  storekit2Mode,
  storekitHybridMode,
} from './internal';
import {
  Product,
  ProductPurchase,
  ProductType,
  Purchase,
  PurchaseResult,
  RequestPurchase,
  RequestSubscription,
  Subscription,
  SubscriptionIOS,
  SubscriptionPlatform,
  SubscriptionPurchase,
} from './types';

export {IapIos, IapIosSk2, isIosStorekit2};

const {RNIapIos, RNIapIosSk2} = NativeModules;

/**
 * STOREKIT1_MODE: Will not enable Storekit 2 even if the device supports it. Thigs will work as before,
 * minimum changes required in the migration guide (default)
 * HYBRID_MODE: Will enable Storekit 2 for iOS devices > 15.0 but will fallback to Sk1 on older devices
 * There are some edge cases that you need to handle in this case (described in migration guide). This mode
 * is for developers that are migrating to Storekit 2 but want to keep supporting older versions.
 * STOREKIT2_MODE: Will *only* enable Storekit 2. This disables Storekit 1. This is for apps that
 * have already targeted a min version of 15 for their app.
 */
export type STOREKIT_OPTIONS =
  | 'STOREKIT1_MODE'
  | 'STOREKIT_HYBRID_MODE'
  | 'STOREKIT2_MODE';

export const setup = ({
  storekitMode = 'STOREKIT1_MODE',
}: {
  storekitMode?: STOREKIT_OPTIONS;
} = {}) => {
  switch (storekitMode) {
    case 'STOREKIT1_MODE':
      storekit1Mode();
      break;
    case 'STOREKIT2_MODE':
      storekit2Mode();
      break;
    case 'STOREKIT_HYBRID_MODE':
      storekitHybridMode();
      break;
    default:
      break;
  }
};

/**
 * Init module for purchase flow. Required on Android. In ios it will check whether user canMakePayment.
 * ## Usage

```tsx
import React, {useEffect} from 'react';
import {View} from 'react-native';
import {initConnection} from 'react-native-iap';

const App = () => {
  useEffect(() => {
    void initConnection();
  }, []);

  return <View />;
};
```
 */
export const initConnection = (): Promise<boolean> =>
  getNativeModule().initConnection();

/**
 * Disconnects from native SDK
 * Usage
 * ```tsx
import React, {useEffect} from 'react';
import {View} from 'react-native';
import {endConnection} from 'react-native-iap';

const App = () => {
  useEffect(() => {
    return () => {
      void endConnection();
    };
  }, []);

  return <View />;
};
```
 * @returns {Promise<void>}
 */
export const endConnection = (): Promise<boolean> =>
  getNativeModule().endConnection();

/**
 * Get a list of products (consumable and non-consumable items, but not subscriptions)
 ## Usage

```ts
import React, {useState} from 'react';
import {Platform} from 'react-native';
import {getProducts, Product} from 'react-native-iap';

const skus = Platform.select({
  ios: ['com.example.consumableIos'],
  android: ['com.example.consumableAndroid'],
});

const App = () => {
  const [products, setProducts] = useState<Product[]>([]);

  const handleProducts = async () => {
    const items = await getProducts({skus});

    setProducts(items);
  };

  useEffect(() => {
    void handleProducts();
  }, []);

  return (
    <>
      {products.map((product) => (
        <Text key={product.productId}>{product.productId}</Text>
      ))}
    </>
  );
};
```

Just a few things to keep in mind:

- You can get your products in `componentDidMount`, `useEffect` or another appropriate area of your app.
- Since a user may start your app with a bad or no internet connection, preparing/getting the items more than once may be a good idea.
- If the user has no IAPs available when the app starts first, you may want to check again when the user enters your IAP store.

 */
export const getProducts = ({
  skus,
}: {
  skus: string[];
}): Promise<Array<Product>> => {
  if (!skus?.length) {
    return Promise.reject('"skus" is required');
  }
  return (
    Platform.select({
      ios: async () => {
        let items: Product[];
        if (isIosStorekit2()) {
          items = ((await RNIapIosSk2.getItems(skus)) as ProductSk2[]).map(
            productSk2Map,
          );
        } else {
          items = (await RNIapIos.getItems(skus)) as Product[];
        }
        return items.filter((item: Product) => skus.includes(item.productId));
      }
    }) || (() => Promise.reject(new Error('Unsupported Platform')))
  )();
};

/**
 * Get a list of subscriptions
 * ## Usage

```tsx
import React, {useCallback} from 'react';
import {View} from 'react-native';
import {getSubscriptions} from 'react-native-iap';

const App = () => {
  const subscriptions = useCallback(
    async () =>
      await getSubscriptions({skus:['com.example.product1', 'com.example.product2']}),
    [],
  );

  return <View />;
};
```

 */
export const getSubscriptions = ({
  skus,
}: {
  skus: string[];
}): Promise<Subscription[]> => {
  if (!skus?.length) {
    return Promise.reject('"skus" is required');
  }
  return (
    Platform.select({
      ios: async (): Promise<SubscriptionIOS[]> => {
        let items: SubscriptionIOS[];
        if (isIosStorekit2()) {
          items = ((await RNIapIosSk2.getItems(skus)) as ProductSk2[]).map(
            subscriptionSk2Map,
          );
        } else {
          items = (await RNIapIos.getItems(skus)) as SubscriptionIOS[];
        }

        items = items.filter((item: SubscriptionIOS) =>
          skus.includes(item.productId),
        );

        return addSubscriptionPlatform(items, SubscriptionPlatform.ios);
      },
    }) || (() => Promise.reject(new Error('Unsupported Platform')))
  )();
};

/**
 * Adds an extra property to subscriptions so we can distinguish the platform
 * we retrieved them on.
 */
const addSubscriptionPlatform = <T>(
  subscriptions: T[],
  platform: SubscriptionPlatform,
): T[] => {
  return subscriptions.map((subscription) => ({...subscription, platform}));
};

/**
 * Gets an inventory of purchases made by the user regardless of consumption status
 * ## Usage

```tsx
import React, {useCallback} from 'react';
import {View} from 'react-native';
import {getPurchaseHistory} from 'react-native-iap';

const App = () => {
  const history = useCallback(
    async () =>
      await getPurchaseHistory([
        'com.example.product1',
        'com.example.product2',
      ]),
    [],
  );

  return <View />;
};
```
@param {alsoPublishToEventListener}:boolean. (IOS Sk2 only) When `true`, every element will also be pushed to the purchaseUpdated listener.
Note that this is only for backaward compatiblity. It won't publish to transactionUpdated (Storekit2) Defaults to `false`
@param {automaticallyFinishRestoredTransactions}:boolean. (IOS Sk1 only) When `true`, all the transactions that are returned are automatically
finished. This means that if you call this method again you won't get the same result on the same device. On the other hand, if `false` you'd
have to manually finish the returned transaction once you have delivered the content to your user.
@param {onlyIncludeActiveItems}:boolean. (IOS Sk2 only). Defaults to false, meaning that it will return one transaction per item purchased.
@See https://developer.apple.com/documentation/storekit/transaction/3851204-currententitlements for details
 */
export const getPurchaseHistory = ({
  alsoPublishToEventListener = false,
  automaticallyFinishRestoredTransactions = true,
  onlyIncludeActiveItems = false,
}: {
  alsoPublishToEventListener?: boolean;
  automaticallyFinishRestoredTransactions?: boolean;
  onlyIncludeActiveItems?: boolean;
} = {}): Promise<Purchase[]> =>
  (
    Platform.select({
      ios: async () => {
        if (isIosStorekit2()) {
          return Promise.resolve(
            (
              await RNIapIosSk2.getAvailableItems(
                alsoPublishToEventListener,
                onlyIncludeActiveItems,
              )
            ).map(transactionSk2ToPurchaseMap),
          );
        } else {
          return RNIapIos.getAvailableItems(
            automaticallyFinishRestoredTransactions,
          );
        }
      },
    }) || (() => Promise.resolve([]))
  )();

/**
 * Get all purchases made by the user (either non-consumable, or haven't been consumed yet)
 * ## Usage

```tsx
import React, {useCallback} from 'react';
import {View} from 'react-native';
import {getAvailablePurchases} from 'react-native-iap';

const App = () => {
  const availablePurchases = useCallback(
    async () => await getAvailablePurchases(),
    [],
  );

  return <View />;
};
```

## Restoring purchases

You can use `getAvailablePurchases()` to do what's commonly understood as "restoring" purchases.

:::note
For debugging you may want to consume all items, you have then to iterate over the purchases returned by `getAvailablePurchases()`.
:::

:::warning
Beware that if you consume an item without having recorded the purchase in your database the user may have paid for something without getting it delivered and you will have no way to recover the receipt to validate and restore their purchase.
:::

```tsx
import React from 'react';
import {Button} from 'react-native';
import {getAvailablePurchases,finishTransaction} from 'react-native-iap';

const App = () => {
  handleRestore = async () => {
    try {
      const purchases = await getAvailablePurchases();
      const newState = {premium: false, ads: true};
      let titles = [];

      await Promise.all(purchases.map(async purchase => {
        switch (purchase.productId) {
          case 'com.example.premium':
            newState.premium = true;
            titles.push('Premium Version');
            break;

          case 'com.example.no_ads':
            newState.ads = false;
            titles.push('No Ads');
            break;

          case 'com.example.coins100':
            await finishTransaction({purchase});
            CoinStore.addCoins(100);
        }
      }));

      Alert.alert(
        'Restore Successful',
        `You successfully restored the following purchases: ${titles.join(', ')}`,
      );
    } catch (error) {
      console.warn(error);
      Alert.alert(error.message);
    }
  };

  return (
    <Button title="Restore purchases" onPress={handleRestore} />
  )
};
```
@param {alsoPublishToEventListener}:boolean When `true`, every element will also be pushed to the purchaseUpdated listener.
Note that this is only for backaward compatiblity. It won't publish to transactionUpdated (Storekit2) Defaults to `false`
@param {onlyIncludeActiveItems}:boolean. (IOS Sk2 only). Defaults to true, meaning that it will return the transaction if suscription has not expired.
@See https://developer.apple.com/documentation/storekit/transaction/3851204-currententitlements for details
 *
 */
export const getAvailablePurchases = ({
  alsoPublishToEventListener = false,
  automaticallyFinishRestoredTransactions = false,
  onlyIncludeActiveItems = true,
}: {
  alsoPublishToEventListener?: boolean;
  automaticallyFinishRestoredTransactions?: boolean;
  onlyIncludeActiveItems?: boolean;
} = {}): Promise<Purchase[]> =>
  (
    Platform.select({
      ios: async () => {
        if (isIosStorekit2()) {
          return Promise.resolve(
            (
              await RNIapIosSk2.getAvailableItems(
                alsoPublishToEventListener,
                onlyIncludeActiveItems,
              )
            ).map(transactionSk2ToPurchaseMap),
          );
        } else {
          return RNIapIos.getAvailableItems(
            automaticallyFinishRestoredTransactions,
          );
        }
      },
    }) || (() => Promise.resolve([]))
  )();

/**
 * Request a purchase for product. This will be received in `PurchaseUpdatedListener`.
 * Request a purchase for a product (consumables or non-consumables).

The response will be received through the `PurchaseUpdatedListener`.

:::note
`andDangerouslyFinishTransactionAutomatically` defaults to false. We recommend
always keeping at false, and verifying the transaction receipts on the server-side.
:::

## Signature

```ts
requestPurchase(
 The product's sku/ID
  sku,


   * You should set this to false and call finishTransaction manually when you have delivered the purchased goods to the user.
   * @default false

  andDangerouslyFinishTransactionAutomaticallyIOS = false,

  /** Specifies an optional obfuscated string that is uniquely associated with the user's account in your app.
  obfuscatedAccountIdAndroid,

  Specifies an optional obfuscated string that is uniquely associated with the user's profile in your app.
  obfuscatedProfileIdAndroid,

   The purchaser's user ID
  applicationUsername,
): Promise<ProductPurchase>;
```

## Usage

```tsx
import React, {useCallback} from 'react';
import {Button} from 'react-native';
import {requestPurchase, Product, Sku, getProducts} from 'react-native-iap';

const App = () => {
  const products = useCallback(
    async () => getProducts({skus:['com.example.product']}),
    [],
  );

  const handlePurchase = async (sku: Sku) => {
    await requestPurchase({sku});
  };

  return (
    <>
      {products.map((product) => (
        <Button
          key={product.productId}
          title="Buy product"
          onPress={() => handlePurchase(product.productId)}
        />
      ))}
    </>
  );
};
```

 */

export const requestPurchase = (
  request: RequestPurchase,
): Promise<ProductPurchase | void> =>
  (
    Platform.select({
      ios: async () => {
        if (!('sku' in request)) {
          throw new Error('sku is required for iOS purchase');
        }

        const {
          sku,
          andDangerouslyFinishTransactionAutomaticallyIOS = false,
          appAccountToken,
          quantity,
          withOffer,
        } = request;

        if (andDangerouslyFinishTransactionAutomaticallyIOS) {
          console.warn(
            'You are dangerously allowing react-native-iap to finish your transaction automatically. You should set andDangerouslyFinishTransactionAutomatically to false when calling requestPurchase and call finishTransaction manually when you have delivered the purchased goods to the user. It defaults to true to provide backwards compatibility. Will default to false in version 4.0.0.',
          );
        }
        if (isIosStorekit2()) {
          const offer = offerSk2Map(withOffer);

          const purchase = transactionSk2ToPurchaseMap(
            await RNIapIosSk2.buyProduct(
              sku,
              andDangerouslyFinishTransactionAutomaticallyIOS,
              appAccountToken,
              quantity ?? -1,
              offer,
            ),
          );
          return Promise.resolve(purchase);
        } else {
          return RNIapIos.buyProduct(
            sku,
            andDangerouslyFinishTransactionAutomaticallyIOS,
            appAccountToken,
            quantity ?? -1,
            offerToRecord(withOffer),
          );
        }
      },
    }) || Promise.resolve
  )();

/**
 * Request a purchase for product. This will be received in `PurchaseUpdatedListener`.
 * Request a purchase for a subscription.

The response will be received through the `PurchaseUpdatedListener`.

:::note
`andDangerouslyFinishTransactionAutomatically` defaults to false. We recommend
always keeping at false, and verifying the transaction receipts on the server-side.
:::

## Signature

```ts
requestSubscription(
  The product's sku/ID
  sku,


   * You should set this to false and call finishTransaction manually when you have delivered the purchased goods to the user.
   * @default false

  andDangerouslyFinishTransactionAutomaticallyIOS = false,

   purchaseToken that the user is upgrading or downgrading from (Android).
  purchaseTokenAndroid,

  UNKNOWN_SUBSCRIPTION_UPGRADE_DOWNGRADE_POLICY, IMMEDIATE_WITH_TIME_PRORATION, IMMEDIATE_AND_CHARGE_PRORATED_PRICE, IMMEDIATE_WITHOUT_PRORATION, DEFERRED
  prorationModeAndroid = -1,

  /** Specifies an optional obfuscated string that is uniquely associated with the user's account in your app.
  obfuscatedAccountIdAndroid,

  Specifies an optional obfuscated string that is uniquely associated with the user's profile in your app.
  obfuscatedProfileIdAndroid,

  The purchaser's user ID
  applicationUsername,
): Promise<SubscriptionPurchase>
```

## Usage

```tsx
import React, {useCallback} from 'react';
import {Button} from 'react-native';
import {
  requestSubscription,
  Product,
  Sku,
  getSubscriptions,
} from 'react-native-iap';

const App = () => {
  const subscriptions = useCallback(
    async () => getSubscriptions(['com.example.subscription']),
    [],
  );

  const handlePurchase = async (sku: Sku) => {
    await requestSubscription({sku});
  };

  return (
    <>
      {subscriptions.map((subscription) => (
        <Button
          key={subscription.productId}
          title="Buy subscription"
          onPress={() => handlePurchase(subscription.productId)}
        />
      ))}
    </>
  );
};
```
 */
export const requestSubscription = (
  request: RequestSubscription,
): Promise<SubscriptionPurchase | null | void> =>
  (
    Platform.select({
      ios: async () => {
        if (!('sku' in request)) {
          throw new Error('sku is required for iOS subscriptions');
        }

        const {
          sku,
          andDangerouslyFinishTransactionAutomaticallyIOS = false,
          appAccountToken,
          quantity,
          withOffer,
        } = request;

        if (andDangerouslyFinishTransactionAutomaticallyIOS) {
          console.warn(
            'You are dangerously allowing react-native-iap to finish your transaction automatically. You should set andDangerouslyFinishTransactionAutomatically to false when calling requestPurchase and call finishTransaction manually when you have delivered the purchased goods to the user. It defaults to true to provide backwards compatibility. Will default to false in version 4.0.0.',
          );
        }

        if (isIosStorekit2()) {
          const offer = offerSk2Map(withOffer);

          const purchase = transactionSk2ToPurchaseMap(
            await RNIapIosSk2.buyProduct(
              sku,
              andDangerouslyFinishTransactionAutomaticallyIOS,
              appAccountToken,
              quantity ?? -1,
              offer,
            ),
          );
          return Promise.resolve(purchase);
        } else {
          return RNIapIos.buyProduct(
            sku,
            andDangerouslyFinishTransactionAutomaticallyIOS,
            appAccountToken,
            quantity ?? -1,
            offerToRecord(withOffer),
          );
        }
      },
    }) || (() => Promise.resolve(null))
  )();

/**
 * Finish Transaction (both platforms)
 *   Abstracts  Finish Transaction
 *   iOS: Tells StoreKit that you have delivered the purchase to the user and StoreKit can now let go of the transaction.
 *   Call this after you have persisted the purchased state to your server or local data in your app.
 *   `react-native-iap` will continue to deliver the purchase updated events with the successful purchase until you finish the transaction. **Even after the app has relaunched.**
 *   Android: it will consume purchase for consumables and acknowledge purchase for non-consumables.
 *
```tsx
import React from 'react';
import {Button} from 'react-native';
import {finishTransaction} from 'react-native-iap';

const App = () => {
  const handlePurchase = async () => {
    // ... handle the purchase request

    const result = finishTransaction({purchase});
  };

  return <Button title="Buy product" onPress={handlePurchase} />;
};
```
 @returns {Promise<PurchaseResult | boolean>} Android: PurchaseResult, iOS: true
 */
export const finishTransaction = ({
  purchase,
}: {
  purchase: Purchase;
  isConsumable?: boolean;
}): Promise<PurchaseResult | boolean> => {
  return (
    Platform.select({
      ios: async () => {
        const transactionId = purchase.transactionId;

        if (!transactionId) {
          return Promise.reject(
            new Error('transactionId required to finish iOS transaction'),
          );
        }
        await getIosModule().finishTransaction(transactionId);
        return Promise.resolve(true);
      },
    }) || (() => Promise.reject(new Error('Unsupported Platform')))
  )();
};

/**
 * Deeplinks to native interface that allows users to manage their subscriptions
 *
 */
export const deepLinkToSubscriptions = ({
}: {
  sku?: string;
}): Promise<void> => {
  return (
    Platform.select({
      ios: async () => {
        IapIos.deepLinkToSubscriptionsIos();
      },
    }) || (() => Promise.reject(new Error('Unsupported Platform')))
  )();
};
