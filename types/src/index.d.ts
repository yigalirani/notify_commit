export declare const key_pair_schema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TString;
    project_id: import("@sinclair/typebox").TString;
    private_key_id: import("@sinclair/typebox").TString;
    private_key: import("@sinclair/typebox").TString;
    client_email: import("@sinclair/typebox").TString;
    client_id: import("@sinclair/typebox").TString;
    auth_uri: import("@sinclair/typebox").TString;
    token_uri: import("@sinclair/typebox").TString;
    auth_provider_x509_cert_url: import("@sinclair/typebox").TString;
    client_x509_cert_url: import("@sinclair/typebox").TString;
    universe_domain: import("@sinclair/typebox").TString;
}>;
export declare const token_response_schema: import("@sinclair/typebox").TObject<{
    access_token: import("@sinclair/typebox").TString;
    scope: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    token_type: import("@sinclair/typebox").TString;
    expires_in: import("@sinclair/typebox").TNumber;
}>;
