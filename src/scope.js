'use strict';

var _ = require('lodash');

function Scope() {
  this.$$watchers = [];
}

function initWatchVal() {}

Scope.prototype.$watch = function(watchFn, listenerFn) {
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    last: initWatchVal
  };

  this.$$watchers.push(watcher); 
};

Scope.prototype.$digest = function() {
  var ttl = 10;
  var dirty;
  do {
    dirty = this.$$digestOnce();
    // if (dirty && () {
    //   throw '10 digest iterations reached';
    // }
  } while (dirty);
};

Scope.prototype.$$digestOnce = function() {
  var self = this;
  var newValue; 
  var oldValue;
  var dirty; 

  _.forEach(this.$$watchers, function(watcher) {
    newValue = watcher.watchFn(self);
    oldValue = watcher.last;
    if (newValue !== oldValue) {
      watcher.last = newValue;
      watcher.listenerFn(newValue, (oldValue === initWatchVal ? newValue : oldValue), self);
      dirty = true;
    } 
  });

  return dirty;
};

module.exports = Scope;

// left off on "Keeping THe Digest GOing While It Stays Dirty p.41"