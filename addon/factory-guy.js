import Ember from 'ember';
import DS from 'ember-data';
import ModelDefinition from './model-definition';
import FixtureBuilderFactory from './fixture-builder-factory';

var modelDefinitions = {};

/**
  Given a fixture name like 'person' or 'dude' determine what model this name
  refers to. In this case it's 'person' for each one.

  @param {String} name  a fixture name could be model name like 'person'
  or a named person in model definition like 'dude'
  @returns {String} model  name associated with fixture name or undefined if not found
  */
var lookupModelForFixtureName = function (name) {
  var definition = lookupDefinitionForFixtureName(name);
  if (definition) {
    return definition.modelName;
  }
};

/**

  @param {String} name a fixture name could be model name like 'person'
  or a named person in model definition like 'dude'
  @returns {ModelDefinition} ModelDefinition associated with model or undefined if not found
  */
var lookupDefinitionForFixtureName = function (name) {
  for (var model in modelDefinitions) {
    var definition = modelDefinitions[model];
    if (definition.matchesName(name)) {
      return definition;
    }
  }
};

var extractArgumentsShort = function() {
  var args = Array.prototype.slice.call(arguments);

  var opts = {};
  if (Ember.typeOf(args[args.length - 1]) === 'object') {
    opts = args.pop();
  }
  // whatever is left are traits
  var traits = Ember.A(args).compact();
  return {opts: opts, traits: traits};
};

/**
  extract arguments for build and make function
  @param {String} name  fixture name
  @param {String} trait  optional trait names ( one or more )
  @param {Object} opts  optional fixture options that will override default fixture values
  @returns {Object} json fixture
  */
var extractArguments = function () {
  var args = Array.prototype.slice.call(arguments);
  var name = args.shift();
  if (!name) {
    throw new Error('Build needs a factory name to build');
  }
  return Ember.merge({name: name}, extractArgumentsShort.apply(this, args));
};

var FactoryGuy =  Ember.Object.extend({

  store: Ember.computed({
    set(_, aStore) {
      Ember.assert("FactoryGuy#set('store') needs a valid store instance.You passed in [" + aStore + "]", aStore instanceof DS.Store);
      return aStore;
    }
  }),

  fixtureBuilderFactory: Ember.computed('store', function() {
    const store = this.get('store');
    return FixtureBuilderFactory.create({ store });
  }),

  fixtureBuilder: Ember.computed('fixtureBuilderFactory', function() {
    const factory = this.get('fixtureBuilderFactory');
    return factory.get('fixtureBuilder');
  }),

  updateHTTPMethod: Ember.computed('fixtureBuilder', function() {
    return this.getWithDefault('fixtureBuilder.updateHTTPMethod', 'PUT');
  }),
  /**
   ```javascript

   Person = DS.Model.extend({
     type: DS.attr('string'),
     name: DS.attr('string')
   })

   FactoryGuy.define('person', {
     sequences: {
       personName: function(num) {
         return 'person #' + num;
       },
       personType: function(num) {
         return 'person type #' + num;
       }
     },
     default: {
       type: 'normal',
       name: FactoryGuy.generate('personName')
     },
     dude: {
       type: FactoryGuy.generate('personType')
     },
   });

   ```

   For the Person model, you can define named fixtures like 'dude' or
   just use 'person' and get default values.

   And to get those fixtures you would call them this way:

   FactoryGuy.build('dude') or FactoryGuy.build('person')

   @param {String} model the model to define
   @param {Object} config your model definition
   */
  define(model, config) {
    modelDefinitions[model] = new ModelDefinition(model, config);
  },
  /*
    @param model name of named fixture type like: 'admin' or model name like 'user'
    @returns {ModelDefinition} if there is one matching that name
   */
  findModelDefinition(model) {
    return modelDefinitions[model];
  },

  /**
   The method has been kept for backward compatibility
   Use `instance.get('fixtureBuilder')` instead.
   */
  getFixtureBuilder() {
    return this.get('fixtureBuilder');
  },

  /**
   Used in model definitions to declare use of a sequence. For example:

   ```

   FactoryGuy.define('person', {
     sequences: {
       personName: function(num) {
         return 'person #' + num;
       }
     },
     default: {
       name: FactoryGuy.generate('personName')
     }
   });

   ```

   @param   {String|Function} value previously declared sequence name or
   an inline function to use as the sequence
   @returns {Function} wrapper function that is called by the model
   definition containing the sequence
   */
  generate(nameOrFunction) {
    var sortaRandomName = Math.floor((1 + Math.random()) * 65536).toString(16) + Date.now();
    return function () {
      // this function will be called by ModelDefinition, which has it's own generate method
      if (Ember.typeOf(nameOrFunction) === 'function') {
        return this.generate(sortaRandomName, nameOrFunction);
      } else {
        return this.generate(nameOrFunction);
      }
    };
  },
  /**
   Used in model definitions to define a belongsTo association attribute.
   For example:

   ```
   FactoryGuy.define('project', {
       default: {
         title: 'Project'
       },

       // setup named project with built in associated user
       project_with_admin: {
         user: FactoryGuy.belongsTo('admin')
       }

       // or use as a trait
       traits: {
         with_admin: {
           user: FactoryGuy.belongsTo('admin')
         }
       }
     })
   ```

   @param   {String} fixtureName fixture name
   @param   {Object} opts options
   @returns {Function} wrapper function that will build the association json
   */
  belongsTo(fixtureName, opts) {
    return ()=> {
      return this.buildRaw(fixtureName, opts);
    };
  },
  /**
   Used in model definitions to define a hasMany association attribute.
   For example:

   ```
   FactoryGuy.define('user', {
     default: {
       name: 'Bob'
     },

     // define the named user type that will have projects
     user_with_projects: { FactoryGuy.hasMany('project', 2) }

     // or use as a trait
     traits: {
       with_projects: {
         projects: FactoryGuy.hasMany('project', 2)
       }
     }
   })

   ```

   @param   {String} fixtureName fixture name
   @param   {Number} number of hasMany association items to build
   @param   {Object} opts options
   @returns {Function} wrapper function that will build the association json
   */
  hasMany(fixtureName, number, opts) {
    return ()=> {
      return this.buildRawList(fixtureName, number, opts);
    };
  },

  /**
   Build fixtures for model or specific fixture name.

   For example:

   ```

   FactoryGuy.build('user') for User model
   FactoryGuy.build('bob') for a 'bob' User
   FactoryGuy.build('bob', 'dude') for a 'bob' User with dude traits
   FactoryGuy.build('bob', 'dude', 'funny') for a 'bob' User with dude and funny traits
   FactoryGuy.build('bob', 'dude', {name: 'wombat'}) for a 'bob' User with dude trait and custom attribute name of 'wombat'

   ```

   @param {String} name  fixture name
   @param {String} trait  optional trait names ( one or more )
   @param {Object} opts  optional fixture options that will override default fixture values
   @returns {Object} json fixture
   */
  build() {
    var args = extractArguments.apply(this, arguments);
    var fixture = this.buildRaw.apply(this, arguments);
    var modelName = lookupModelForFixtureName(args.name);

    return this.get('fixtureBuilder').convertForBuild(modelName, fixture);
  },

  buildRaw() {
    var args = extractArguments.apply(this, arguments);

    var definition = lookupDefinitionForFixtureName(args.name);
    if (!definition) {
      throw new Error('Can\'t find that factory named [' + args.name + ']');
    }

    return definition.build(args.name, args.opts, args.traits);
  },
  /**
   Build list of fixtures for model or specific fixture name. For example:

   ```

   FactoryGuy.buildList('user', 2) for 2 User models
   FactoryGuy.build('bob', 2) for 2 User model with bob attributes

   ```

   @param {String} name  fixture name
   @param {Number} number  number of fixtures to create
   @param {String} trait  optional traits (one or more)
   @param {Object} opts  optional fixture options that will override default fixture values
   @returns {Array} list of fixtures
   */
  buildList() {
    var args = Array.prototype.slice.call(arguments);
    var name = args.shift();
    var list = this.buildRawList.apply(this, arguments);

    var modelName = lookupModelForFixtureName(name);
    return this.get('fixtureBuilder').convertForBuild(modelName, list);
  },

  buildRawList() {
    var args = Array.prototype.slice.call(arguments);
    if (args.length < 2) {
      throw new Error('buildList needs a name and a number ( at least ) to build with');
    }
    var name = args.shift();
    var definition = lookupDefinitionForFixtureName(name);
    if (!definition) {
      throw new Error("Can't find that factory named [" + name + "]");
    }
    if (typeof(args[0]) === 'number') {
      var number = args.shift();
      var parts = extractArgumentsShort.apply(this, args);
      return definition.buildList(name, number, parts.traits, parts.opts);
    }
    else {
      return args.map(function(innerArgs) {
        if(Ember.typeOf(innerArgs) !== 'array') {
          innerArgs = [innerArgs];
        }
        var parts = extractArgumentsShort.apply(this, innerArgs);
        return definition.build(name, parts.opts, parts.traits);
      });
    }
  },
  /**
   Make new fixture and save to store.

   @param {String} name  fixture name
   @param {String} trait  optional trait names ( one or more )
   @param {Object} options  optional fixture options that will override default fixture values
   @returns {DS.Model} record
   */
  make() {
    var args = extractArguments.apply(this, arguments);

    Ember.assert(
      "FactoryGuy does not have the application's store." +
      " Use FactoryGuy.set('store', store) before making any fixtures", this.get('store')
    );

    var modelName = lookupModelForFixtureName(args.name);
    var fixture = this.buildRaw.apply(this, arguments);
    var data = this.get('fixtureBuilder').convertForMake(modelName, fixture);

    const model = Ember.run(()=> this.get('store').push(data) );

    var definition = lookupDefinitionForFixtureName(args.name);
    if (definition.hasAfterMake()) {
      definition.applyAfterMake(model, args.opts);
    }
    return model;
  },

  /**
   Make a list of Fixtures

   @param {String} name name of fixture
   @param {Number} number number to create
   @param {String} trait  optional trait names ( one or more )
   @param {Object} options  optional fixture options that will override default fixture values
   @returns {Array} list of json fixtures or records depending on the adapter type
   */
  makeList() {
    Ember.assert("FactoryGuy does not have the application's store. Use FactoryGuy.set('store', store) before making any fixtures", this.get('store'));

    var arr = [];
    var args = Array.prototype.slice.call(arguments);
    Ember.assert("makeList needs at least 2 arguments, a name and a number", args.length >= 2);
    var number = args.splice(1, 1)[0];
    Ember.assert("Second argument to makeList should be a number (of fixtures to make.)", typeof number === 'number');

    for (var i = 0; i < number; i++) {
      arr.push(this.make.apply(this, args));
    }
    return arr;
  },
  /**
   Clear model instances from store cache.
   Reset the id sequence for the models back to zero.
   */
  clearStore() {
    this.resetDefinitions();
    this.clearModels();
  },

  /**
   Reset the id sequence for the models back to zero.
   */
  resetDefinitions() {
    for (var model in modelDefinitions) {
      var definition = modelDefinitions[model];
      definition.reset();
    }
  },

  /**
   Clear model instances from store cache.
   */
  clearModels() {
    this.get('store').unloadAll();
  },

  /**
   Push fixture to model's FIXTURES array.
   Used when store's adapter is a DS.FixtureAdapter.

   @param {DS.Model} modelClass
   @param {Object} fixture the fixture to add
   @returns {Object} json fixture data
   */
  pushFixture(modelClass, fixture) {
    var index;
    if (!modelClass.FIXTURES) {
      modelClass.FIXTURES = [];
    }

    index = this.indexOfFixture(modelClass.FIXTURES, fixture);

    if (index > -1) {
      modelClass.FIXTURES.splice(index, 1);
    }

    modelClass.FIXTURES.push(fixture);

    return fixture;
  },

  /**
   Used in compliment with pushFixture in order to
   ensure we don't push duplicate fixtures

   @private
   @param {Array} fixtures
   @param {String|Integer} id of fixture to find
   @returns {Object} fixture
   */
  indexOfFixture(fixtures, fixture) {
    var index = -1,
      id = fixture.id + '';
    Ember.A(fixtures).find(function (r, i) {
      if ('' + Ember.get(r, 'id') === id) {
        index = i;
        return true;
      } else {
        return false;
      }
    });
    return index;
  },

  /**
   Clears all model definitions
   */
  clearDefinitions(opts) {
    if (!opts) {
      modelDefinitions = {};
    }
  }

});

var factoryGuy = FactoryGuy.create();

var make = factoryGuy.make.bind(factoryGuy);
var makeList = factoryGuy.makeList.bind(factoryGuy);
var build = factoryGuy.build.bind(factoryGuy);
var buildList = factoryGuy.buildList.bind(factoryGuy);
var clearStore = factoryGuy.clearStore.bind(factoryGuy);

export { make, makeList, build, buildList, clearStore };
export default factoryGuy;
