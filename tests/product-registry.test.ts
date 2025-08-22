import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface ProductRecord {
  owner: string;
  origin: string;
  manufacturer: string;
  materials: string[];
  productionDate: number;
  metadata: string;
  status: string;
  visibility: boolean;
  lastUpdated: number;
}

interface VersionRecord {
  updatedMetadata: string;
  updateNotes: string;
  timestamp: number;
}

interface CategoryRecord {
  category: string;
  tags: string[];
}

interface CollaboratorRecord {
  role: string;
  permissions: string[];
  addedAt: number;
}

interface BatchRecord {
  products: string[];
  batchSize: number;
  createdAt: number;
}

interface SerialRecord {
  serialNumber: string;
  qrCodeHash: string | null;
}

interface ContractState {
  productRegistry: Map<string, ProductRecord>;
  productVersions: Map<string, VersionRecord>; // Key: `${productId}-${version}`
  productCategories: Map<string, CategoryRecord>;
  productCollaborators: Map<string, CollaboratorRecord>; // Key: `${productId}-${collaborator}`
  productBatch: Map<string, BatchRecord>;
  productSerials: Map<string, SerialRecord>;
  paused: boolean;
  contractOwner: string;
  blockHeight: number; // Mock block height
}

// Mock contract implementation
class ProductRegistryMock {
  private state: ContractState = {
    productRegistry: new Map(),
    productVersions: new Map(),
    productCategories: new Map(),
    productCollaborators: new Map(),
    productBatch: new Map(),
    productSerials: new Map(),
    paused: false,
    contractOwner: "deployer",
    blockHeight: 1000,
  };

  private ERR_UNAUTHORIZED = 100;
  private ERR_ALREADY_REGISTERED = 101;
  private ERR_INVALID_ID = 102;
  private ERR_INVALID_STATUS = 106;
  private ERR_INVALID_CATEGORY = 107;
  private ERR_INVALID_VERSION = 112;
  private ERR_NOT_OWNER = 105;
  private ERR_PAUSED = 116;
  private ERR_INVALID_BATCH_SIZE = 114;
  private ERR_INVALID_SERIAL = 115;
  private MAX_METADATA_LEN = 500;
  private MAX_TAGS = 10;
  private MAX_PERMISSIONS = 5;
  private MAX_NOTES_LEN = 200;
  private MAX_BATCH_SIZE = 100;

  // Helper to increment mock block height
  private incrementBlockHeight() {
    this.state.blockHeight += 1;
  }

  registerProduct(
    caller: string,
    productId: string,
    origin: string,
    manufacturer: string,
    materials: string[],
    metadata: string
  ): ClarityResponse<boolean> {
    this.incrementBlockHeight();
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (this.state.productRegistry.has(productId)) {
      return { ok: false, value: this.ERR_ALREADY_REGISTERED };
    }
    if (
      productId.length === 0 ||
      origin.length === 0 ||
      manufacturer.length === 0 ||
      metadata.length > this.MAX_METADATA_LEN
    ) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    this.state.productRegistry.set(productId, {
      owner: caller,
      origin,
      manufacturer,
      materials,
      productionDate: this.state.blockHeight,
      metadata,
      status: "registered",
      visibility: true,
      lastUpdated: this.state.blockHeight,
    });
    return { ok: true, value: true };
  }

  updateProductStatus(
    caller: string,
    productId: string,
    newStatus: string
  ): ClarityResponse<boolean> {
    this.incrementBlockHeight();
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const product = this.state.productRegistry.get(productId);
    if (!product) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (product.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (newStatus.length === 0 || newStatus.length > 20) {
      return { ok: false, value: this.ERR_INVALID_STATUS };
    }
    this.state.productRegistry.set(productId, {
      ...product,
      status: newStatus,
      lastUpdated: this.state.blockHeight,
    });
    return { ok: true, value: true };
  }

  addProductVersion(
    caller: string,
    productId: string,
    version: number,
    updatedMetadata: string,
    notes: string
  ): ClarityResponse<boolean> {
    this.incrementBlockHeight();
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const product = this.state.productRegistry.get(productId);
    if (!product) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (product.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (
      updatedMetadata.length > this.MAX_METADATA_LEN ||
      notes.length > this.MAX_NOTES_LEN ||
      version === 0
    ) {
      return { ok: false, value: this.ERR_INVALID_VERSION };
    }
    const key = `${productId}-${version}`;
    this.state.productVersions.set(key, {
      updatedMetadata,
      updateNotes: notes,
      timestamp: this.state.blockHeight,
    });
    return { ok: true, value: true };
  }

  addProductCategory(
    caller: string,
    productId: string,
    category: string,
    tags: string[]
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const product = this.state.productRegistry.get(productId);
    if (!product) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (product.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (category.length === 0 || tags.length > this.MAX_TAGS) {
      return { ok: false, value: this.ERR_INVALID_CATEGORY };
    }
    this.state.productCategories.set(productId, { category, tags });
    return { ok: true, value: true };
  }

  addCollaborator(
    caller: string,
    productId: string,
    collaborator: string,
    role: string,
    permissions: string[]
  ): ClarityResponse<boolean> {
    this.incrementBlockHeight();
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const product = this.state.productRegistry.get(productId);
    if (!product) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (product.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (role.length === 0 || permissions.length > this.MAX_PERMISSIONS) {
      return { ok: false, value: this.ERR_INVALID_CATEGORY }; // Reusing error for simplicity
    }
    const key = `${productId}-${collaborator}`;
    this.state.productCollaborators.set(key, {
      role,
      permissions,
      addedAt: this.state.blockHeight,
    });
    return { ok: true, value: true };
  }

  registerBatch(
    caller: string,
    batchId: string,
    products: string[]
  ): ClarityResponse<boolean> {
    this.incrementBlockHeight();
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (batchId.length === 0 || products.length === 0 || products.length > this.MAX_BATCH_SIZE) {
      return { ok: false, value: this.ERR_INVALID_BATCH_SIZE };
    }
    this.state.productBatch.set(batchId, {
      products,
      batchSize: products.length,
      createdAt: this.state.blockHeight,
    });
    return { ok: true, value: true };
  }

  setSerialNumber(
    caller: string,
    productId: string,
    serial: string,
    qrHash: string | null
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const product = this.state.productRegistry.get(productId);
    if (!product) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (product.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (serial.length === 0) {
      return { ok: false, value: this.ERR_INVALID_SERIAL };
    }
    this.state.productSerials.set(productId, { serialNumber: serial, qrCodeHash: qrHash });
    return { ok: true, value: true };
  }

  transferOwnership(
    caller: string,
    productId: string,
    newOwner: string
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const product = this.state.productRegistry.get(productId);
    if (!product) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (product.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    this.state.productRegistry.set(productId, { ...product, owner: newOwner });
    return { ok: true, value: true };
  }

  togglePause(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = !this.state.paused;
    return { ok: true, value: this.state.paused };
  }

  getProductDetails(productId: string): ClarityResponse<ProductRecord | null> {
    return { ok: true, value: this.state.productRegistry.get(productId) ?? null };
  }

  getProductVersion(
    productId: string,
    version: number
  ): ClarityResponse<VersionRecord | null> {
    const key = `${productId}-${version}`;
    return { ok: true, value: this.state.productVersions.get(key) ?? null };
  }

  getProductCategory(productId: string): ClarityResponse<CategoryRecord | null> {
    return { ok: true, value: this.state.productCategories.get(productId) ?? null };
  }

  getCollaborator(
    productId: string,
    collaborator: string
  ): ClarityResponse<CollaboratorRecord | null> {
    const key = `${productId}-${collaborator}`;
    return { ok: true, value: this.state.productCollaborators.get(key) ?? null };
  }

  getBatchDetails(batchId: string): ClarityResponse<BatchRecord | null> {
    return { ok: true, value: this.state.productBatch.get(batchId) ?? null };
  }

  getSerialNumber(productId: string): ClarityResponse<SerialRecord | null> {
    return { ok: true, value: this.state.productSerials.get(productId) ?? null };
  }

  isPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  getOwner(productId: string): ClarityResponse<string | number> {
    const product = this.state.productRegistry.get(productId);
    if (!product) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    return { ok: true, value: product.owner };
  }

  verifyOwnership(productId: string, claimedOwner: string): ClarityResponse<boolean | number> {
    const product = this.state.productRegistry.get(productId);
    if (!product) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    return { ok: true, value: product.owner === claimedOwner };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  producer: "wallet_1",
  user1: "wallet_2",
  user2: "wallet_3",
};

describe("ProductRegistry Contract", () => {
  let contract: ProductRegistryMock;

  beforeEach(() => {
    contract = new ProductRegistryMock();
    vi.resetAllMocks();
  });

  it("should register a new product successfully", () => {
    const result = contract.registerProduct(
      accounts.producer,
      "prod-001",
      "Ethiopia",
      "Farm XYZ",
      ["organic beans"],
      "Coffee batch"
    );
    expect(result).toEqual({ ok: true, value: true });

    const details = contract.getProductDetails("prod-001");
    expect(details).toEqual({
      ok: true,
      value: expect.objectContaining({
        owner: accounts.producer,
        origin: "Ethiopia",
        status: "registered",
      }),
    });
  });

  it("should prevent registration of duplicate product", () => {
    contract.registerProduct(
      accounts.producer,
      "prod-001",
      "Ethiopia",
      "Farm XYZ",
      ["organic beans"],
      "Coffee batch"
    );

    const duplicate = contract.registerProduct(
      accounts.producer,
      "prod-001",
      "Kenya",
      "Farm ABC",
      ["beans"],
      "Another batch"
    );
    expect(duplicate).toEqual({ ok: false, value: 101 });
  });

  it("should update product status by owner", () => {
    contract.registerProduct(
      accounts.producer,
      "prod-001",
      "Ethiopia",
      "Farm XYZ",
      ["organic beans"],
      "Coffee batch"
    );

    const update = contract.updateProductStatus(accounts.producer, "prod-001", "shipped");
    expect(update).toEqual({ ok: true, value: true });

    const details = contract.getProductDetails("prod-001");
    expect(details.value?.status).toBe("shipped");
  });

  it("should prevent status update by non-owner", () => {
    contract.registerProduct(
      accounts.producer,
      "prod-001",
      "Ethiopia",
      "Farm XYZ",
      ["organic beans"],
      "Coffee batch"
    );

    const update = contract.updateProductStatus(accounts.user1, "prod-001", "shipped");
    expect(update).toEqual({ ok: false, value: 105 });
  });

  it("should add product version", () => {
    contract.registerProduct(
      accounts.producer,
      "prod-001",
      "Ethiopia",
      "Farm XYZ",
      ["organic beans"],
      "Coffee batch"
    );

    const addVersion = contract.addProductVersion(
      accounts.producer,
      "prod-001",
      1,
      "Updated metadata",
      "Version notes"
    );
    expect(addVersion).toEqual({ ok: true, value: true });

    const version = contract.getProductVersion("prod-001", 1);
    expect(version).toEqual({
      ok: true,
      value: expect.objectContaining({ updateNotes: "Version notes" }),
    });
  });

  it("should add product category", () => {
    contract.registerProduct(
      accounts.producer,
      "prod-001",
      "Ethiopia",
      "Farm XYZ",
      ["organic beans"],
      "Coffee batch"
    );

    const addCategory = contract.addProductCategory(
      accounts.producer,
      "prod-001",
      "food",
      ["organic", "fair-trade"]
    );
    expect(addCategory).toEqual({ ok: true, value: true });

    const category = contract.getProductCategory("prod-001");
    expect(category.value?.category).toBe("food");
  });

  it("should add collaborator", () => {
    contract.registerProduct(
      accounts.producer,
      "prod-001",
      "Ethiopia",
      "Farm XYZ",
      ["organic beans"],
      "Coffee batch"
    );

    const addCollab = contract.addCollaborator(
      accounts.producer,
      "prod-001",
      accounts.user1,
      "distributor",
      ["update-status"]
    );
    expect(addCollab).toEqual({ ok: true, value: true });

    const collab = contract.getCollaborator("prod-001", accounts.user1);
    expect(collab.value?.role).toBe("distributor");
  });

  it("should register batch", () => {
    const registerBatch = contract.registerBatch(
      accounts.producer,
      "batch-001",
      ["prod-001", "prod-002"]
    );
    expect(registerBatch).toEqual({ ok: true, value: true });

    const batch = contract.getBatchDetails("batch-001");
    expect(batch.value?.batchSize).toBe(2);
  });

  it("should set serial number", () => {
    contract.registerProduct(
      accounts.producer,
      "prod-001",
      "Ethiopia",
      "Farm XYZ",
      ["organic beans"],
      "Coffee batch"
    );

    const setSerial = contract.setSerialNumber(
      accounts.producer,
      "prod-001",
      "SN12345",
      "hash123"
    );
    expect(setSerial).toEqual({ ok: true, value: true });

    const serial = contract.getSerialNumber("prod-001");
    expect(serial.value?.serialNumber).toBe("SN12345");
  });

  it("should transfer ownership", () => {
    contract.registerProduct(
      accounts.producer,
      "prod-001",
      "Ethiopia",
      "Farm XYZ",
      ["organic beans"],
      "Coffee batch"
    );

    const transfer = contract.transferOwnership(accounts.producer, "prod-001", accounts.user1);
    expect(transfer).toEqual({ ok: true, value: true });

    const owner = contract.getOwner("prod-001");
    expect(owner).toEqual({ ok: true, value: accounts.user1 });
  });

  it("should toggle pause by owner", () => {
    const toggle = contract.togglePause(accounts.deployer);
    expect(toggle).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: true });
  });

  it("should prevent actions when paused", () => {
    contract.togglePause(accounts.deployer);

    const register = contract.registerProduct(
      accounts.producer,
      "prod-001",
      "Ethiopia",
      "Farm XYZ",
      ["organic beans"],
      "Coffee batch"
    );
    expect(register).toEqual({ ok: false, value: 116 });
  });

  it("should verify ownership correctly", () => {
    contract.registerProduct(
      accounts.producer,
      "prod-001",
      "Ethiopia",
      "Farm XYZ",
      ["organic beans"],
      "Coffee batch"
    );

    const verify = contract.verifyOwnership("prod-001", accounts.producer);
    expect(verify).toEqual({ ok: true, value: true });

    const wrongVerify = contract.verifyOwnership("prod-001", accounts.user1);
    expect(wrongVerify).toEqual({ ok: true, value: false });
  });
});