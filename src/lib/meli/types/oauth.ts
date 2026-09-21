export interface MeliTokenResponse {
  access_token: string;
  token_type: string;
  /** Rule 12: the TTL always comes from here. Official examples disagree (10800 vs 21600). */
  expires_in: number;
  scope: string;
  user_id: number;
  /** Rotating, single use. Persist before releasing the refresh lease. */
  refresh_token: string;
}

export interface OAuthMaterial {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  credentialVersion: number;
  status: string;
}
