var FactoryGuyTestMixin = Em.Mixin.create({
  // Pass in the app root, which typically is App.
  setup: function (app) {
    this.set('container', app.__container__);
    return this;
  },
  useFixtureAdapter: function (app) {
    app.ApplicationAdapter = DS.FixtureAdapter;
    this.getStore().adapterFor('application').simulateRemoteResponse = false;
  },
  /**
   @param {String} model type like user for model User
   @return {boolean} true if model's serializer is ActiveModelSerializer based
   */
  usingActiveModelSerializer: function (type) {
    var store = this.getStore();
    var modelType = store.modelFor(type);
    var serializer = store.serializerFor(modelType.typeKey);
    return serializer instanceof DS.ActiveModelSerializer;
  },
  /**
   Proxy to store's find method

   @param {String or subclass of DS.Model} type
   @param {Object|String|Integer|null} id
   @return {Promise} promise
   */
  find: function (type, id) {
    return this.getStore().find(type, id);
  },
  /**
   Proxy to store's makeFixture method

   */
  make: function () {
    var store = this.getStore();
    return store.makeFixture.apply(store, arguments);
  },
  getStore: function () {
    return this.get('container').lookup('store:main');
  },
  pushPayload: function (type, hash) {
    return this.getStore().pushPayload(type, hash);
  },
  pushRecord: function (type, hash) {
    return this.getStore().push(type, hash);
  },
  /**
   Using mockjax to stub an http request.

   @param {String} url request url
   @param {Object} json response
   @param {Object} options ajax request options
   */
  stubEndpointForHttpRequest: function (url, json, options) {
    options = options || {};
    var request = {
      url: url,
      dataType: 'json',
      responseText: json,
      type: options.type || 'GET',
      status: options.status || 200
    };
    if (options.data) {
      request.data = options.data;
    }
    $.mockjax(request);
  },
  /**
   Build url for the mockjax call. Proxy to the adapters buildURL method.

   @param {String} typeName model type name like 'user' for User model
   @param {String} id
   @return {String} url
   */
  buildURL: function (typeName, id) {
    var type = this.getStore().modelFor(typeName);
    return this.getStore().adapterFor(type).buildURL(type.typeKey, id);
  },
  /**
     Handling ajax GET for finding all records for a type of model.
     You can mock failed find by passing in success argument as false.

     @param {String} name  name of the fixture ( or model ) to find
     @param {Number} number  number of fixtures to create
     @param {String} trait  optional traits (one or more)
     @param {Object} opts  optional fixture options
   */
  handleFindMany: function () {
    var store = this.getStore();
    // make the records and load them in the store
    store.makeList.apply(store, arguments);
    var name = arguments[0];
    var modelName = FactoryGuy.lookupModelForFixtureName(name);
    var responseJson = {};
    responseJson[modelName] = [];
    var url = this.buildURL(modelName);
    // mock the ajax call, but return nothing, since the records will be
    // retrieved from the store where they were just loaded above
    this.stubEndpointForHttpRequest(url, responseJson, { type: 'GET' });
  },
  /**
   Handling ajax POST ( create record ) for a model. You can mock
   failed create by passing in success argument as false.

   ```js
     handleCreate('post')
     handleCreate('post', { match: {title: 'foo'} )
     handleCreate('post', { match: {title: 'foo', user: user} )
     handleCreate('post', { returns: {createdAt: new Date()} )
     handleCreate('post', { match: {title: 'foo'}, returns: {createdAt: new Date()} )
     handleCreate('post', { match: {title: 'foo'}, success: false} } )
   ```

    match - attributes that must be in request json,
    returns - attributes to include in response json,
    succeed - flag to indicate if the request should succeed ( default is true )

    Note that any attributes in match will be added to the response json automatically,
    so you don't need to include them in the returns hash as well.

    Also, if you match on a belongsTo association, you don't have to include that in the
    returns hash.

   @param {String} modelName  name of model your creating like 'profile' for Profile
   @param {Object} options  hash of options for handling request
   */
  handleCreate: function (modelName, options) {
    options = options === undefined ? {} : options;
    var succeed = options.succeed === undefined ? true : options.succeed;
    var match = options.match || {};
    var returnArgs = options.returns || {};

    var url = this.buildURL(modelName);
    var definition = FactoryGuy.modelDefinitions[modelName];

    var record = this.getStore().createRecord(modelName, match);
    var expectedRequest = {};
    expectedRequest[modelName] = record.serialize();

    var httpOptions = {type: 'POST', data: JSON.stringify(expectedRequest)};

    var modelType = this.getStore().modelFor(modelName)

    var responseJson = {};
    if (succeed) {
      responseJson[modelName] = $.extend({id: definition.nextId()}, match, returnArgs);
      // Remove belongsTo associations since they will already be set when you called
      // createRecord, and included them in those attributes
      Ember.get(modelType, 'relationshipsByName').forEach(function (relationship) {
        if (relationship.kind == 'belongsTo') {
          delete responseJson[modelName][relationship.key];
        }
      })
    } else {
      httpOptions.status = 500;
    }

    this.stubEndpointForHttpRequest(url, responseJson, httpOptions);
  },
  /**
   Handling ajax PUT ( update record ) for a model type. You can mock
   failed update by passing in success argument as false.

   @param {String} type  model type like 'user' for User model
   @param {String} id  id of record to update
   @param {Boolean} succeed  optional flag to indicate if the request
      should succeed ( default is true )
   */
  handleUpdate: function (type, id, succeed) {
    succeed = succeed === undefined ? true : succeed;
    this.stubEndpointForHttpRequest(this.buildURL(type, id), {}, {
      type: 'PUT',
      status: succeed ? 200 : 500
    });
  },
  /**
   Handling ajax DELETE ( delete record ) for a model type. You can mock
   failed delete by passing in success argument as false.

   @param {String} type  model type like 'user' for User model
   @param {String} id  id of record to update
   @param {Boolean} succeed  optional flag to indicate if the request
      should succeed ( default is true )
   */
  handleDelete: function (type, id, succeed) {
    succeed = succeed === undefined ? true : succeed;
    this.stubEndpointForHttpRequest(this.buildURL(type, id), {}, {
      type: 'DELETE',
      status: succeed ? 200 : 500
    });
  },
  teardown: function () {
    FactoryGuy.resetModels(this.getStore());
    $.mockjax.clear();
  }
});

