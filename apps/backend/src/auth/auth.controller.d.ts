import { AuthService } from './auth.service';
import { VerificationService } from '../verification/verification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyIdentityDto } from '../verification/dto/verify-identity.dto';
export declare class AuthController {
    private authService;
    private verificationService;
    constructor(authService: AuthService, verificationService: VerificationService);
    register(registerDto: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: any;
            email: any;
            full_name: any;
            identity_verified: any;
        };
    }>;
    login(loginDto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: any;
            email: any;
            full_name: any;
            identity_verified: any;
        };
    }>;
    refreshToken(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: any;
            email: any;
            full_name: any;
            identity_verified: any;
        };
    }>;
    verifyIdentity(user: any, verifyIdentityDto: VerifyIdentityDto): Promise<any>;
    getProfile(user: any): Promise<any>;
}
//# sourceMappingURL=auth.controller.d.ts.map