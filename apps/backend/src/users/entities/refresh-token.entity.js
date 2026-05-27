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
exports.RefreshToken = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let RefreshToken = (() => {
    let _classDecorators = [(0, typeorm_1.Entity)('refresh_tokens'), (0, typeorm_1.Index)('idx_refresh_tokens_user', ['user_id'])];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _id_decorators;
    let _id_initializers = [];
    let _id_extraInitializers = [];
    let _user_id_decorators;
    let _user_id_initializers = [];
    let _user_id_extraInitializers = [];
    let _token_hash_decorators;
    let _token_hash_initializers = [];
    let _token_hash_extraInitializers = [];
    let _expires_at_decorators;
    let _expires_at_initializers = [];
    let _expires_at_extraInitializers = [];
    let _revoked_decorators;
    let _revoked_initializers = [];
    let _revoked_extraInitializers = [];
    let _created_at_decorators;
    let _created_at_initializers = [];
    let _created_at_extraInitializers = [];
    let _user_decorators;
    let _user_initializers = [];
    let _user_extraInitializers = [];
    var RefreshToken = _classThis = class {
        constructor() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.user_id = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _user_id_initializers, void 0));
            this.token_hash = (__runInitializers(this, _user_id_extraInitializers), __runInitializers(this, _token_hash_initializers, void 0));
            this.expires_at = (__runInitializers(this, _token_hash_extraInitializers), __runInitializers(this, _expires_at_initializers, void 0));
            this.revoked = (__runInitializers(this, _expires_at_extraInitializers), __runInitializers(this, _revoked_initializers, void 0));
            this.created_at = (__runInitializers(this, _revoked_extraInitializers), __runInitializers(this, _created_at_initializers, void 0));
            this.user = (__runInitializers(this, _created_at_extraInitializers), __runInitializers(this, _user_initializers, void 0));
            __runInitializers(this, _user_extraInitializers);
        }
    };
    __setFunctionName(_classThis, "RefreshToken");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)('uuid')];
        _user_id_decorators = [(0, typeorm_1.Column)({ type: 'uuid' })];
        _token_hash_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 64 })];
        _expires_at_decorators = [(0, typeorm_1.Column)({ type: 'timestamptz' })];
        _revoked_decorators = [(0, typeorm_1.Column)({ type: 'boolean', default: false })];
        _created_at_decorators = [(0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' })];
        _user_decorators = [(0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.refresh_tokens, { onDelete: 'CASCADE' })];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: obj => "id" in obj, get: obj => obj.id, set: (obj, value) => { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _user_id_decorators, { kind: "field", name: "user_id", static: false, private: false, access: { has: obj => "user_id" in obj, get: obj => obj.user_id, set: (obj, value) => { obj.user_id = value; } }, metadata: _metadata }, _user_id_initializers, _user_id_extraInitializers);
        __esDecorate(null, null, _token_hash_decorators, { kind: "field", name: "token_hash", static: false, private: false, access: { has: obj => "token_hash" in obj, get: obj => obj.token_hash, set: (obj, value) => { obj.token_hash = value; } }, metadata: _metadata }, _token_hash_initializers, _token_hash_extraInitializers);
        __esDecorate(null, null, _expires_at_decorators, { kind: "field", name: "expires_at", static: false, private: false, access: { has: obj => "expires_at" in obj, get: obj => obj.expires_at, set: (obj, value) => { obj.expires_at = value; } }, metadata: _metadata }, _expires_at_initializers, _expires_at_extraInitializers);
        __esDecorate(null, null, _revoked_decorators, { kind: "field", name: "revoked", static: false, private: false, access: { has: obj => "revoked" in obj, get: obj => obj.revoked, set: (obj, value) => { obj.revoked = value; } }, metadata: _metadata }, _revoked_initializers, _revoked_extraInitializers);
        __esDecorate(null, null, _created_at_decorators, { kind: "field", name: "created_at", static: false, private: false, access: { has: obj => "created_at" in obj, get: obj => obj.created_at, set: (obj, value) => { obj.created_at = value; } }, metadata: _metadata }, _created_at_initializers, _created_at_extraInitializers);
        __esDecorate(null, null, _user_decorators, { kind: "field", name: "user", static: false, private: false, access: { has: obj => "user" in obj, get: obj => obj.user, set: (obj, value) => { obj.user = value; } }, metadata: _metadata }, _user_initializers, _user_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        RefreshToken = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return RefreshToken = _classThis;
})();
exports.RefreshToken = RefreshToken;
//# sourceMappingURL=refresh-token.entity.js.map