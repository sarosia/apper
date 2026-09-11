const path = require('path');
const os = require('os');
const {Database, FilesystemStorage, Client} = require('@sarosia/notabledb');
const Apper = require('./apper');

class NotableStore {
  #database;
  #collection;
  #idField;

  /**
   * Constructs a NotableStore instance.
   * @param {string|Object} [collection='items'] Collection name or options.
   * @param {Object} [options={}] Storage options.
   */
  constructor(collection = 'items', options = {}) {
    if (typeof collection === 'object' && collection !== null) {
      options = collection;
      collection = options.collection || 'items';
    }
    this.#collection = collection;
    this.#idField = options.idField || 'id';

    if (options.database) {
      this.#database = options.database;
    } else if (options.url || options.notabledbUrl) {
      this.#database = new Client(options.url || options.notabledbUrl);
    } else {
      let dbPath =
        options.storagePath || options.dbPath || options.notabledbPath;
      if (!dbPath) {
        const appName = options.appName || options.name || 'apper';
        dbPath = path.join(os.homedir(), `.${appName}`, 'notabledb.json');
      }
      const resolvedPath = Apper.resolvePath(dbPath);
      const storage = new FilesystemStorage(resolvedPath);
      this.#database = new Database(storage);
    }
  }

  getDatabase() {
    return this.#database;
  }

  getCollectionName() {
    return this.#collection;
  }

  getIdField() {
    return this.#idField;
  }

  /**
   * Generates a unique ID if none provided.
   * @param {Object} item
   * @return {string} Generated ID.
   */
  generateId(item = {}) {
    const base = item.name || item.title || this.#collection;
    const slug = String(base)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 20);
    const rand = Math.random().toString(36).slice(2, 8);
    const fallback = `${this.#collection}-${Date.now()}-${rand}`;
    return slug ? `${slug}-${rand}` : fallback;
  }

  /**
   * Seeds initial items if collection is empty.
   * @param {Array<Object>} initialItems Initial items to seed.
   */
  async init(initialItems = []) {
    const existing = await this.list();
    if (
      existing.length === 0 &&
      initialItems &&
      initialItems.length > 0
    ) {
      const map = {};
      for (const item of initialItems) {
        if (!item) continue;
        const id = item[this.#idField] || this.generateId(item);
        map[id] = {
          ...item,
          [this.#idField]: id,
        };
      }
      await this.#database.update([this.#collection], map);
    }
  }

  /**
   * Lists all items in collection.
   * @return {Promise<Array<Object>>}
   */
  async list() {
    const data = await this.#database.query([this.#collection]);
    if (!data) return [];
    if (Array.isArray(data)) {
      return data.filter(Boolean);
    }
    return Object.values(data);
  }

  /**
   * Gets an item by ID.
   * @param {string} id
   * @return {Promise<Object|null>}
   */
  async get(id) {
    if (!id) return null;
    const item = await this.#database.query([this.#collection, id]);
    if (item) return item;
    const all = await this.list();
    return all.find((it) => it && it[this.#idField] === id) || null;
  }

  /**
   * Adds a new item to the collection.
   * @param {Object} itemData
   * @return {Promise<Object>} Added item.
   */
  async add(itemData) {
    if (!itemData || typeof itemData !== 'object') {
      throw new Error('Item data is required and must be an object.');
    }
    let id = itemData[this.#idField];
    if (!id || (typeof id === 'string' && !id.trim())) {
      id = this.generateId(itemData);
    } else if (typeof id === 'string') {
      id = id.trim();
    }

    const newItem = {
      ...itemData,
      [this.#idField]: id,
    };

    const existing = await this.#database.query([this.#collection]);
    let map = {};
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      map = {...existing};
    } else if (Array.isArray(existing)) {
      for (const item of existing) {
        if (item && item[this.#idField]) {
          map[item[this.#idField]] = item;
        }
      }
    }

    if (map[id]) {
      throw new Error(
          `Item with ${this.#idField} "${id}" already exists.`,
      );
    }

    map[id] = newItem;
    await this.#database.update([this.#collection], map);
    return newItem;
  }

  /**
   * Updates an existing item.
   * @param {string} id
   * @param {Object} updates
   * @return {Promise<Object>} Updated item.
   */
  async update(id, updates = {}) {
    if (!id) {
      throw new Error(`${this.#idField} is required.`);
    }
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Item with ${this.#idField} "${id}" not found.`);
    }

    const updated = {
      ...existing,
      ...updates,
      [this.#idField]: id,
    };

    const allData = await this.#database.query([this.#collection]);
    let map = {};
    if (allData && typeof allData === 'object' && !Array.isArray(allData)) {
      map = {...allData};
    } else if (Array.isArray(allData)) {
      for (const item of allData) {
        if (item && item[this.#idField]) {
          map[item[this.#idField]] = item;
        }
      }
    }

    map[id] = updated;
    await this.#database.update([this.#collection], map);
    return updated;
  }

  /**
   * Removes an item by ID.
   * @param {string} id
   * @return {Promise<Object>} Removed item.
   */
  async remove(id) {
    if (!id) {
      throw new Error(`${this.#idField} is required.`);
    }
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Item with ${this.#idField} "${id}" not found.`);
    }

    const allData = await this.#database.query([this.#collection]);
    if (allData && typeof allData === 'object' && !Array.isArray(allData)) {
      const copy = {...allData};
      delete copy[id];
      await this.#database.update([this.#collection], copy);
    } else if (Array.isArray(allData)) {
      const filtered = allData.filter((it) => it && it[this.#idField] !== id);
      await this.#database.update([this.#collection], filtered);
    } else {
      await this.#database.remove([this.#collection, id]);
    }
    return existing;
  }
}

module.exports = NotableStore;
