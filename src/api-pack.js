const { Method, Type } = require("./enums");
const StrictApiPack = require('./strict-api-pack');

module.exports = class ApiPack {
  constructor() {
    this.checkers = [];
    this.persisters = [];
    this.providers = [];
    this.serializers = [];
    this.validators = [];
    this.operation = {};
    this.routeChecker = null;
  }

  checker(checker) {
    this.checkers.push(checker);
    return this;
  }

  persister(persister) {
    this.persisters.push(persister);
    return this;
  }

  provider(provider) {
    this.providers.push(provider);
    return this;
  }

  serializer(serializer) {
    this.serializers.push(serializer);
    return this;
  }

  validator(validator) {
    this.validators.push(validator);
    return this;
  }

  errors(type) {
    return this.operation.context.errors[type];
  }

  getRouteChecker() {
    return this.routeChecker;
  }

  getOperationChecker() {
    return this.checkers[0] || null;
  }

  getOperationPersister() {
    return this.persisters[0] || null;
  }

  getOperationProvider() {
    return this.providers[0] || null;
  }

  getOperationSerializer() {
    return this.serializers[0] || null;
  }

  getOperationValidator() {
    return this.validators[0] || null;
  }

  async read() {
    this.operation.data = null;
    const provider = this.getOperationProvider();
    if (!provider) return;
    try {
      switch (this.operation.type.toLowerCase()) {
        case Type.COLLECTION:
          this.operation.method.toUpperCase() === Method.POST
            ? (this.operation.data = null)
            : await provider.getCollection(this.operation);
          break;
        case Type.ITEM:
          await provider.getItem(this.operation);
          break;
        case Type.CUSTOM:
          await provider.getData(this.operation);
          break;
      }
    } catch (e) {
      this.operation.data = null;
    }
  }

  async deserialize(data = {}) {
    const method = this.operation.method.toUpperCase();

    if (
      [Method.GET, Method.DELETE].indexOf(method) >= 0 ||
      ([Method.POST, Method.PUT].indexOf(method) >= 0 &&
        !Object.keys(data).length)
    ) {
      return;
    }

    if (!this.operation.data) {
      const provider = this.getOperationProvider();
      if (!provider) return;
      await provider.getInstance(this.operation);
    }
    const serializer = this.getOperationSerializer();
    if (serializer) {
      await serializer.deserialize(this.operation, data);
    }
  }

  async checkRoute() {
    const checker = this.getRouteChecker();
    if (!checker) {
      return;
    }
    await checker.checkRoute(this.operation);
  }

  async check() {
    const checker = this.getOperationChecker();

    if (!checker || !this.operation.data) {
      return;
    }

    await checker.check(this.operation);
  }

  async validate() {
    const method = this.operation.method.toUpperCase();
    const validator = this.getOperationValidator();

    if (Method.GET === method || Method.DELETE === method || !validator) {
      return;
    }

    await validator.validate(this.operation);
  }

  async write() {
    const method = this.operation.method.toUpperCase();
    const persister = this.getOperationPersister();

    if (!persister || method === Method.GET) {
      return;
    }

    switch (method) {
      case Method.PUT:
      case Method.POST:
      case Method.PATCH:
        await persister.persist(this.operation);
        break;
      case Method.DELETE:
        await persister.remove(this.operation);
        break;
    }
  }

  async serialize() {
    const serializer = this.getOperationSerializer();

    if (!serializer || !this.operation.data) {
      return;
    }

    await serializer.serialize(this.operation);
  }

  strictify(operation) {
    return new StrictApiPack({
      operation,
      provider: this.getOperationProvider(),
      persister: this.getOperationPersister(),
      routeChecker: this.getRouteChecker(),
      resourceChecker: this.getOperationChecker(), /** @deprecated method */
      validator: this.getOperationValidator(),
      serializer: this.getOperationSerializer()
    });
  }
};
