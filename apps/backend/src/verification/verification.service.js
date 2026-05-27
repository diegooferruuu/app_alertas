"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationService = void 0;
const common_1 = require("@nestjs/common");
const vision_1 = require("@google-cloud/vision");
const crypto_1 = require("crypto");
let VerificationService = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var VerificationService = _classThis = class {
        constructor(configService, usersService) {
            this.configService = configService;
            this.usersService = usersService;
            const credentialsPath = this.configService.get('GOOGLE_CLOUD_VISION_CREDENTIALS');
            if (credentialsPath) {
                this.visionClient = new vision_1.ImageAnnotatorClient({
                    keyFilename: credentialsPath,
                });
            }
        }
        async verifyIdentity(userId, idCardBase64) {
            if (!this.visionClient) {
                throw new common_1.BadRequestException('Vision API credentials not configured');
            }
            try {
                const imageBuffer = Buffer.from(idCardBase64, 'base64');
                const [result] = await this.visionClient.textDetection({
                    image: { content: imageBuffer },
                });
                const texts = result.textAnnotations;
                if (!texts || texts.length === 0) {
                    throw new common_1.BadRequestException('No text found in ID card image');
                }
                const fullText = texts[0].description;
                const ciMatch = fullText.match(/\d{7,8}/);
                const nameMatch = fullText.match(/[A-Z][a-z]+\s[A-Z][a-z]+/);
                if (!ciMatch) {
                    throw new common_1.BadRequestException('Could not extract CI number from ID card');
                }
                const ciNumber = ciMatch[0];
                const ciHash = (0, crypto_1.createHash)('sha256').update(ciNumber).digest('hex');
                const existingUser = await this.usersService.findByCiHash(ciHash);
                if (existingUser && existingUser.id !== userId) {
                    throw new common_1.BadRequestException('This ID card is already registered');
                }
                const user = await this.usersService.setIdentityVerified(userId, ciHash);
                return {
                    verified: true,
                    ciHash,
                    message: 'Identity verified successfully',
                };
            }
            catch (error) {
                if (error instanceof common_1.BadRequestException) {
                    throw error;
                }
                throw new common_1.BadRequestException(`Verification failed: ${error.message}`);
            }
        }
    };
    __setFunctionName(_classThis, "VerificationService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        VerificationService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return VerificationService = _classThis;
})();
exports.VerificationService = VerificationService;
//# sourceMappingURL=verification.service.js.map