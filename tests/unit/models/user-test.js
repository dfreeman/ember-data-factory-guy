import Ember from 'ember';
import FactoryGuy, { make, manualSetup }  from 'ember-data-factory-guy';
import { test, moduleForModel } from 'ember-qunit';

/**
 This test is NOT using startApp function or App.destroy for cleanup,
 so it is alot faster.

 But you do need to user moduleForModel instead of just module

 As long as your using ember 2.3 of have ember-getowner-pollyfill addon installed
 this style should work for you, and be speedier than calling startApp()

 If this does not work for you ( for whatever reason ) take a look at
 profile-test.js in this same directory for the fool proof way to write a
 model test.
 */

moduleForModel('user', {
 // using integration: true to have all models registered in the container
 // but you could also use needs: [project, client, etc..] to list those you need as well
 integration:true,

 setup: function () {
    // you need ember 2.3 or the ember-getowner-polyfill addon installed for this to work
    manualSetup(Ember.getOwner(this));
  },

  teardown: function () {
    Ember.run(FactoryGuy, 'clearStore');
  }
});

test('has funny name', function () {
  var user = make('user', {name: 'Dude'});
  equal(user.get('funnyName'), 'funny Dude');
});

test('has projects', function () {
  var user = make('user', 'with_projects');
  equal(user.get('projects.length'), 2);
});
