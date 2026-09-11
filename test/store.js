const os = require('os');
const path = require('path');
const {expect} = require('chai');
const Apper = require('../index');
const NotableStore = Apper.NotableStore;
const {Database, InMemoryStorage} = require('@sarosia/notabledb');

describe('NotableStore', () => {
  let inMemoryDb;

  beforeEach(() => {
    inMemoryDb = new Database(new InMemoryStorage());
  });

  it('initializes with default options and creates database', () => {
    const tmpDir = path.join(os.tmpdir(), 'apper-store-test-' + Date.now());
    const store = new NotableStore('items', {
      storagePath: path.join(tmpDir, 'db.json'),
    });
    expect(store.getCollectionName()).to.equal('items');
    expect(store.getIdField()).to.equal('id');
    expect(store.getDatabase()).to.be.an('object');
  });

  it('supports custom idField and database instance injection', () => {
    const store = new NotableStore('tasks', {
      idField: 'name',
      database: inMemoryDb,
    });
    expect(store.getCollectionName()).to.equal('tasks');
    expect(store.getIdField()).to.equal('name');
    expect(store.getDatabase()).to.equal(inMemoryDb);
  });

  it('seeds initial items on init when collection is empty', async () => {
    const store = new NotableStore('tasks', {
      idField: 'name',
      database: inMemoryDb,
    });
    await store.init([
      {name: 'task1', command: 'npm start'},
      {name: 'task2', command: 'node index.js'},
    ]);

    const items = await store.list();
    expect(items).to.have.lengthOf(2);
    expect(items.find((i) => i.name === 'task1').command)
        .to.equal('npm start');
    expect(items.find((i) => i.name === 'task2').command)
        .to.equal('node index.js');

    // Calling init again does not overwrite existing data
    await store.init([
      {name: 'task3', command: 'npm test'},
    ]);
    const itemsAfter = await store.list();
    expect(itemsAfter).to.have.lengthOf(2);
  });

  it('performs CRUD operations: add, get, update, remove, list', async () => {
    const store = new NotableStore('calendars', {
      idField: 'id',
      database: inMemoryDb,
    });

    // List empty
    expect(await store.list()).to.deep.equal([]);

    // Add item
    const created = await store.add({
      id: 'cal-1',
      name: 'Soccer',
      url: 'https://example.com/cal.ics',
    });
    expect(created.id).to.equal('cal-1');
    expect(created.name).to.equal('Soccer');

    // Duplicate add throws
    try {
      await store.add({id: 'cal-1', name: 'Duplicate'});
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.message).to.include('already exists');
    }

    // Get item
    const fetched = await store.get('cal-1');
    expect(fetched).to.not.be.null;
    expect(fetched.name).to.equal('Soccer');
    expect(await store.get('non-existent')).to.be.null;

    // Update item
    const updated = await store.update('cal-1', {
      name: 'Soccer Updated',
      filter: {futureWindow: '30d'},
    });
    expect(updated.name).to.equal('Soccer Updated');
    expect(updated.filter.futureWindow).to.equal('30d');
    expect(updated.url).to.equal('https://example.com/cal.ics');

    // Update non-existent throws
    try {
      await store.update('non-existent', {name: 'Foo'});
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.message).to.include('not found');
    }

    // Remove item
    const removed = await store.remove('cal-1');
    expect(removed.id).to.equal('cal-1');
    expect(await store.get('cal-1')).to.be.null;
    expect(await store.list()).to.deep.equal([]);

    // Remove non-existent throws
    try {
      await store.remove('cal-1');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.message).to.include('not found');
    }
  });

  it('auto-generates unique IDs if not provided', async () => {
    const store = new NotableStore('items', {
      idField: 'id',
      database: inMemoryDb,
    });
    const item = await store.add({name: 'My Special Item'});
    expect(item.id).to.be.a('string');
    expect(item.id).to.include('my-special-item');

    const found = await store.get(item.id);
    expect(found.name).to.equal('My Special Item');
  });

  it('handles existing collections stored as arrays', async () => {
    await inMemoryDb.update(['records'], [
      {id: 'rec-1', val: 100},
      {id: 'rec-2', val: 200},
    ]);

    const store = new NotableStore('records', {
      idField: 'id',
      database: inMemoryDb,
    });

    const list = await store.list();
    expect(list).to.have.lengthOf(2);

    const rec = await store.get('rec-2');
    expect(rec.val).to.equal(200);

    const updated = await store.update('rec-1', {val: 150});
    expect(updated.val).to.equal(150);

    await store.remove('rec-2');
    const remaining = await store.list();
    expect(remaining).to.have.lengthOf(1);
    expect(remaining[0].id).to.equal('rec-1');
  });
});
