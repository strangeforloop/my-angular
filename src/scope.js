'use strict';

var _ = require('lodash');

function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
  this.$$asyncQueue = [];
  this.$$applyAsyncQueue = [];
  this.$$phase = null;
}

function initWatchVal() {}

Scope.prototype.$$areEqual = function (newValue, oldValue, valueEq) {
  if (valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return newValue === oldValue ||
      (typeof newValue === 'number' && typeof oldValue === 'number' &&
        isNaN(newValue) && isNaN(oldValue));
  }
};

Scope.prototype.$beginPhase = function(phase) {
  if (this.$$phase) {
    throw this.$$phase + ' already in progress.';
  }
  this.$$phase = phase;
};

Scope.prototype.$clearPhase = function() {
  this.$$phase = null;
};

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
  var self = this;

  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    valueEq: !!valueEq,
    last: initWatchVal
  };

  self.$$watchers.unshift(watcher); 
  self.$$lastDirtyWatch = null; 

  return function() {
    var index = self.$$watchers.indexOf(watcher);
    if (index >= 0) {
      self.$$watchers.splice(index, 1);
      self.$$lastDirtyWatch = null;
    }
  };
};

Scope.prototype.$digest = function() {
  var ttl = 10;
  var dirty;
  this.$$lastDirtyWatch = null;
  this.$beginPhase('$digest');
 
  do {
    while (this.$$asyncQueue.length) {
      var asyncTask = this.$$asyncQueue.shift();
      asyncTask.scope.$eval(asyncTask.expression);
    }
    dirty = this.$$digestOnce();
    if ((dirty || this.$$asyncQueue.length) && !(ttl--)) {
      throw '10 digest iterations reached';
    }
  } while (dirty || this.$$asyncQueue.length);
  this.$clearPhase();
};

Scope.prototype.$$digestOnce = function() {
  var self = this;
  var newValue; 
  var oldValue;
  var dirty; 
 
  _.forEachRight(this.$$watchers, function (watcher) {
    try {
      if (watcher) {
        newValue = watcher.watchFn(self);
        oldValue = watcher.last;
        if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
          self.$$lastDirtyWatch = watcher;
          watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
          watcher.listenerFn(newValue,
            (oldValue === initWatchVal ? newValue : oldValue),
            self);
          dirty = true;
        } else if (self.$$lastDirtyWatch === watcher) {
          return false; // short circuit eval
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  return dirty;
};

Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};

// basically makes it possible to execute some code that isn't
// aware of Angular's digest cycle
Scope.prototype.$apply = function(expr) {
  try {
    this.$beginPhase('$apply');
    return expr(this);
  } finally {
    // finally block makes sure the digest will happen even if the
    // supplied function throws an exception
    this.$clearPhase();
    this.$digest();
  }
};

Scope.prototype.$evalAsync = function(expr) {
  var self = this;

  if (!self.$$phase && !self.$$asyncQueue.length) {
    // ensure the function returns immediately rather than evaluating
    // the expression synchronously regardless of status of the 
    // digest cycle
    // prevents confusion if someone calls $evalAsync from outside 
    // a digest
    setTimeout(function() {
      if (self.$$asyncQueue.length) {
        self.$digest();
      }
    }, 0); 
  }

  self.$$asyncQueue.push({ scope: self, expression: expr });
};

Scope.prototype.$applyAsync = function (expr) {
  var self = this;
  self.$$applyAsyncQueue.push(function () {
    self.$eval(expr);
  });

  // in the timeout, $apply a function that drains the queue and invokes
  // functions in it
  setTimeout(function() {
    self.$apply(function() {
      while (self.$$applyAsyncQueue.length) {
        self.$$applyAsyncQueue.shift()();
      }
    });
  }, 0);
};

module.exports = Scope;
