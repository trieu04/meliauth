export interface AccessClaims {
  sub: number;
  type: "access";
  username: string;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

export interface RefreshClaims {
  sub: number;
  jti: number;
  type: "refresh";
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

export interface RequestMetadata {
  userAgent: string | null;
  ipAddress: string | null;
}
