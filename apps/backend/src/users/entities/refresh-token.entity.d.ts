import { User } from './user.entity';
export declare class RefreshToken {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    revoked: boolean;
    created_at: Date;
    user: User;
}
//# sourceMappingURL=refresh-token.entity.d.ts.map