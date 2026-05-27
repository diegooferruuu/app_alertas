import { RefreshToken } from './refresh-token.entity';
import { ReputationEvent } from './reputation-event.entity';
export declare class User {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    password_hash: string;
    identity_verified: boolean;
    ci_hash: string;
    identity_verified_at: Date;
    reputation_score: number;
    is_suspended: boolean;
    suspended_at: Date;
    suspension_reason: string;
    push_token: string;
    push_token_updated_at: Date;
    last_location: string;
    last_location_at: Date;
    role: 'citizen' | 'admin';
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;
    refresh_tokens: RefreshToken[];
    reputation_events: ReputationEvent[];
}
//# sourceMappingURL=user.entity.d.ts.map