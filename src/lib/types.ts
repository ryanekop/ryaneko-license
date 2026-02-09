// Database Types for License Management System

export type ProductSlug =
    | 'raw-file-copy-tool'
    | 'realtime-upload-pro'
    | 'photo-split-express'
    | 'fastpik';

export type LicenseStatus = 'available' | 'used' | 'revoked';

export type DeviceType = 'macOS' | 'macOS-Monterey' | 'Windows';

export interface Product {
    id: string;
    name: string;
    slug: ProductSlug;
    detection_keywords: string[];
    download_urls: Record<DeviceType, string>;
    plugin_url?: string;
    has_plugin: boolean;
    created_at: string;
}

export interface License {
    id: string;
    product_id: string;
    serial_key: string;
    serial_hash: string;
    status: LicenseStatus;

    // Customer Info (filled on purchase)
    customer_name?: string;
    customer_email?: string;
    order_id?: string;

    // Activation Info (filled on app activation)
    device_type?: DeviceType;
    device_id?: string;
    device_hash?: string;
    activated_at?: string;
    last_active_at?: string;

    batch_info?: string;
    notes?: string;
    created_at: string;

    // Join
    product?: Product;
}

export interface Purchase {
    id: string;
    order_id: string;
    product_id: string;
    customer_name: string;
    customer_email: string;
    license_count: number;
    includes_plugin: boolean;
    addons?: Record<string, unknown>;
    raw_payload?: Record<string, unknown>;
    licenses_assigned: string[];
    created_at: string;

    // Join
    product?: Product;
}

export interface Activation {
    id: string;
    license_id: string;
    action: 'activate' | 'verify' | 'transfer' | 'revoke';
    device_id?: string;
    device_type?: DeviceType;
    os_version?: string;
    ip_address?: string;
    success: boolean;
    error_message?: string;
    created_at: string;
}

// Mayar Webhook Payload Types
export interface MayarWebhookPayload {
    event?: string;
    data?: MayarOrderData;
    // Direct fields (some webhooks send directly without data wrapper)
    id?: string;
    productName?: string;
    product_name?: string;
    customerName?: string;
    customer_name?: string;
    customerEmail?: string;
    customer_email?: string;
    addOn?: MayarAddon[];
    addons?: MayarAddon[];
    items?: MayarAddon[];
}

export interface MayarOrderData {
    id: string;
    productName?: string;
    product_name?: string;
    customerName?: string;
    customer_name?: string;
    customerEmail?: string;
    customer_email?: string;
    addOn?: MayarAddon[];
    addons?: MayarAddon[];
    items?: MayarAddon[];
}

export interface MayarAddon {
    productName?: string;
    name?: string;
}

// API Response Types
export interface ActivationRequest {
    serial_key: string;
    device_id: string;
    device_type: DeviceType;
    os_version?: string;
}

export interface ActivationResponse {
    success: boolean;
    message: string;
    license_id?: string;
    product_name?: string;
    activated_at?: string;
}

export interface VerifyRequest {
    serial_key: string;
    device_id: string;
}

export interface VerifyResponse {
    valid: boolean;
    message: string;
    product_name?: string;
    expires_at?: string; // For future subscription model
}
