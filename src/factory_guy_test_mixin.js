var FactoryGuyTestMixin = Em.Mixin.create({
  // Pass in the app root, which typically is App.
  setup: function (app) {
    this.set('container', app.__container__);
    FactoryGuy.setStore(this.getStore());
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
   Make new fixture and save to store. Proxy to FactoryGuy#make method
   */
  make: function () {
    return FactoryGuy.make.apply(FactoryGuy, arguments);
  },
  getStore: function () {
    return this.get('container').lookup('store:main');
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
    if (options.urlParams) {
      request.urlParams = options.urlParams;
    }
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
    // make the records and load them in the store
    FactoryGuy.makeList.apply(FactoryGuy, arguments);
    var name = arguments[0];
    var modelName = FactoryGuy.lookupModelForFixtureName(name);
    var responseJson = {};
    responseJson[modelName] = [];
    var url = this.buildURL(modelName);
    // mock the ajax call, but return nothing, since the records will be
    // retrieved from the store where they were just loaded above
    this.stubEndpointForHttpRequest(url, responseJson);
  },
  /**
   Handling ajax GET for finding all records for a type of model with query parameters.

          First variation = pass in fixture json

   ```js

     // First build json for the instances you want 'returned' in your query.
     var usersJson = FactoryGuy.buildList('user', 2);

     // Pass in the parameters you will search on ( in this case 'name' and 'age' ) as an array,
     // in the second argument.
     testHelper.handleFindQuery('user', ['name', 'age'], usersJson);

     store.findQuery('user', {name:'Bob', age: 10}}).then(function(userInstances){
        // userInstances returned are created from the usersJson that you passed in
     });
   ```

          Second variation = pass in model instances
   ```js

     // Create model instances
     var users = FactoryGuy.makeList('user', 2, 'with_hats');

     // Pass in the array of model instances as last argument
     testHelper.handleFindQuery('user', ['name', 'age'], users);

     store.findQuery('user', {name:'Bob', age: 10}}).then(function(userInstances){
        /// userInstances will be the same of the users that were passed in
     })
   ```

        Third variation - pass in nothing for last argument
   ```js
   // This simulates a query that returns no results
   testHelper.handleFindQuery('user', ['age']);

   store.findQuery('user', {age: 10000}}).then(function(userInstances){
        /// userInstances will be empty
     })
   ```

   @param {String} modelName  name of the mode like 'user' for User model type
   @param {String} searchParams  the parameters that will be queried
   @param {Object|DS.Model} array  json array of fixture data used to build the resulting
    model instances or an array of model instances that are already in the store
   */
  handleFindQuery: function (modelName, searchParams, array) {
    Ember.assert('The second argument of searchParams must be an array',Em.typeOf(arguments[1]) == 'array')
    var json = [];
    if (!Em.isEmpty(array)) {
      if (Em.typeOf(array[0]) == 'instance') {
        json = array.map(function(user) {return user.toJSON({includeId: true})})
      } else {
        json = array;
      }
    }
    var responseJson = {};
    responseJson[modelName.pluralize()] = json;
    var url = this.buildURL(modelName);
    this.stubEndpointForHttpRequest(url, responseJson, {urlParams: searchParams});
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

    Note:
     1) that any attributes in match will be added to the response json automatically,
    so you don't need to include them in the returns hash as well.

     2) If you don't use match options for exact match, there will be no id returned to the model.
        The reason being, that this method purposely returns an empty hash response with a 'don't match'
        style handleCreate, because if the responseJson returns a non empty data hash ( with even only
        the id), this essentially empty hash of attributes will override ( and nullify ) all the attributes
        that set when you created the record.
     3) If you match on a belongsTo association, you don't have to include that in the
    returns hash.

   @param {String} modelName  name of model your creating like 'profile' for Profile
   @param {Object} options  hash of options for handling request
   */
  handleCreate: function (modelName, options) {
    var opts = options === undefined ? {} : options;
    var succeed = opts.succeed === undefined ? true : opts.succeed;
    var match = opts.match || {};
    var returnArgs = opts.returns || {};

    var url = this.buildURL(modelName);
    var definition = FactoryGuy.modelDefinitions[modelName];

    var httpOptions = {type: 'POST'};
    if (opts.match) {
      var expectedRequest = {};
      var record = this.getStore().createRecord(modelName, match);
      expectedRequest[modelName] = record.serialize();
      httpOptions.data = JSON.stringify(expectedRequest);
    }

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
  handleUpdate: function () {
    var args = Array.prototype.slice.call(arguments)
    Ember.assert("To handleUpdate pass in a model instance or a type and an id", args.length>0)
    var succeed = true;
    if (typeof args[args.length-1] == 'boolean') {
      args.pop()
      succeed = false;
    }
    Ember.assert("To handleUpdate pass in a model instance or a type and an id",args.length>0)
    var type, id;
    if (args[0] instanceof DS.Model) {
      var model = args[0];
      type = model.constructor.typeKey;
      id = model.id;
    } else if (typeof args[0] == "string" && typeof parseInt(args[1]) == "number") {
      type = args[0];
      id = args[1];
    }
    Ember.assert("To handleUpdate pass in a model instance or a type and an id",type && id)
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

if (FactoryGuy !== undefined) {
  FactoryGuy.testMixin = FactoryGuyTestMixin;
};
