import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
export declare class VerificationService {
    private configService;
    private usersService;
    private visionClient;
    constructor(configService: ConfigService, usersService: UsersService);
    verifyIdentity(userId: string, idCardBase64: string): Promise<any>;
}
//# sourceMappingURL=verification.service.d.ts.map