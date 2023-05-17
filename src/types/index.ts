import type {
  IosModuleProps,
} from '../modules';
import type {IosModulePropsSk2} from '../modules/iosSk2';

import type * as Apple from './apple';

export type Sku = string;

export const PROMOTED_PRODUCT = 'iap-promoted-product';


export enum ProductType {
  /** Subscription */
  subs = 'subs',

  /** Subscription */
  sub = 'sub',

  /** Consumable */
  inapp = 'inapp',

  /** Consumable */
  iap = 'iap',
}

export interface ProductCommon {
  type: 'subs' | 'sub' | 'inapp' | 'iap';
  productId: string; //iOS
  productIds?: string[];
  title: string;
  description: string;
  price: string;
  currency: string;
  localizedPrice: string;
  countryCode?: string;
}

export interface ProductPurchase {
  productId: string;
  transactionId?: string;
  transactionDate: number;
  transactionReceipt: string;
  purchaseToken?: string;
  //iOS
  quantityIOS?: number;
  originalTransactionDateIOS?: number;
  originalTransactionIdentifierIOS?: string;
  verificationResultIOS?: string;
}

export interface PurchaseResult {
  responseCode?: number;
  debugMessage?: string;
  code?: string;
  message?: string;
  purchaseToken?: string;
}

export interface SubscriptionPurchase extends ProductPurchase {
  originalTransactionDateIOS?: number;
  originalTransactionIdentifierIOS?: string;
  verificationResultIOS?: string;
}

export type Purchase = ProductPurchase | SubscriptionPurchase;

export interface Discount {
  identifier: string;
  type: string;
  numberOfPeriods: string;
  price: string;
  localizedPrice: string;
  paymentMode: '' | 'FREETRIAL' | 'PAYASYOUGO' | 'PAYUPFRONT';
  subscriptionPeriod: string;
}

export interface ProductIOS extends ProductCommon {
  type: 'inapp' | 'iap';
}

export type Product = ProductIOS;

/**
 * Can be used to distinguish the different platforms' subscription information
 */
export enum SubscriptionPlatform {
  ios = 'ios',
}

export type SubscriptionIosPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | '';
export interface SubscriptionIOS extends ProductCommon {
  platform: SubscriptionPlatform.ios;
  type: 'subs';
  discounts?: Discount[];
  introductoryPrice?: string;
  introductoryPriceAsAmountIOS?: string;
  introductoryPricePaymentModeIOS?:
    | ''
    | 'FREETRIAL'
    | 'PAYASYOUGO'
    | 'PAYUPFRONT';
  introductoryPriceNumberOfPeriodsIOS?: string;
  introductoryPriceSubscriptionPeriodIOS?: SubscriptionIosPeriod;

  subscriptionPeriodNumberIOS?: string;
  subscriptionPeriodUnitIOS?: SubscriptionIosPeriod;
}

export type Subscription = SubscriptionIOS;

export interface RequestPurchaseIOS {
  sku: Sku;
  andDangerouslyFinishTransactionAutomaticallyIOS?: boolean;
  /**
   * UUID representing user account
   */
  appAccountToken?: string;
  quantity?: number;
  withOffer?: Apple.PaymentDiscount;
}

export type RequestPurchase = RequestPurchaseIOS;

/**
 * In order to purchase a new subscription, every sku must have a selected offerToken
 * @see SubscriptionAndroid.subscriptionOfferDetails.offerToken
 */
export interface SubscriptionOffer {
  sku: Sku;
  offerToken: string;
}

export type RequestSubscriptionIOS = RequestPurchaseIOS;


export type RequestSubscription = RequestSubscriptionIOS;

declare module 'react-native' {
  interface NativeModulesStatic {
    RNIapIos: IosModuleProps;
    RNIapIosSk2: IosModulePropsSk2;
  }
}
