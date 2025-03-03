import Ember from 'ember';
import $ from 'jquery';

/**
 * Attribute Transformer for JSONAPISerializer
 * The default transform is to dasherize.
 *
 * @constructor
 */
var JSONAPIAttributeTransformer = function (store) {
  var defaultValueTransformFn = function(x) { return x; };

  /**
   * Transform attributes in fixture.
   *
   * @param fixture
   * @returns {*} new copy of old fixture with transformed attributes
   */
  this.transform = function (modelName, fixture) {
    var newData, included = [];
    if (Ember.typeOf(fixture.data) === 'array') {
      newData = fixture.data.map(function (single) {
        var copy = $.extend(true, {}, single);
        transformSingle(modelName, copy);
        return copy;
      });
    } else {
      newData = $.extend(true, {}, fixture.data);
      transformSingle(modelName, newData);
    }
    if (fixture.included) {
      included = fixture.included.map(function (single) {
        var copy = $.extend(true, {}, single);
        transformSingle(modelName, copy);
        return copy;
      });
    }
    var newFixture = {data: newData};
    if (!Ember.isEmpty(included)) {
      newFixture.included = included;
    }
    return newFixture;
  };
  /**
   Transform single record

   @param modelName
   @param fixture
   */
  var transformSingle = function (modelName, fixture) {
    transformAttributes(modelName, fixture);
    findRelationships(modelName, fixture);
  };

  var transformAttributes = function(modelName, object) {
    if (object.attributes) {
      transformObjectValues(modelName, object.attributes);
      transformObjectKeys(modelName, object.attributes, 'Attribute');
    }
  };

  var transformRelationshipObjectKeys = function(modelName, object) {
    transformObjectKeys(modelName, object, 'Relationship');
  };

  var transformObjectKeys = function(modelName, object, keyType) {
    var serializer = store.serializerFor(modelName);
    var transformFunction = serializer['keyFor'+keyType] || Ember.String.dasherize;
    for (var key in object) {
      var value = object[key];
      var newKey = transformFunction(key);
      delete object[key];
      object[newKey] = value;
    }
  };

  /**
   Apply value transformers to attributes with custom type

   @param modelName
   @param object
   */
  var transformObjectValues = function(modelName, object) {
    var model = store.modelFor(modelName);
    for (var key in object) {
      var attributeType = Ember.get(model, 'transformedAttributes').get(key);
      var transformValue = getTransformValueFunction(attributeType);
      var value = object[key];
      object[key] = transformValue(value);
    }
  };

  /**
   Return a transform function for a custom attribute type (or the identity function otherwise).

   @param type
   */
  var getTransformValueFunction = function(type) {
    var container = Ember.getOwner ? Ember.getOwner(store) : store.container;
    return type ? container.lookup('transform:' + type).serialize : defaultValueTransformFn;
  };

  /**
   Recursively descend into the fixture json, looking for relationships
   whose attributes need transforming
   */
  var findRelationships = function (modelName, fixture) {
    var relationships = fixture.relationships;
    for (var key in relationships) {
      var data = relationships[key].data;
      if (Ember.typeOf(data) === 'array') {
        for (var i = 0, len = data.length; i < len; i++) {
          transformAttributes(modelName, data[i]);
        }
      } else {
        transformAttributes(modelName, data);
      }
    }
    transformRelationshipObjectKeys(modelName, fixture.relationships);
  };

};

export default JSONAPIAttributeTransformer;
