var RTL$ = {
    extend: function extend(methods){
        function Type(){
            for(var m in methods)
                this[m] = methods[m];
        }
        Type.prototype = this.prototype;

        var result = methods.init;
        result.prototype = new Type(); // inherit this.prototype
        result.prototype.constructor = result; // to see constructor name in diagnostic
        
        result.extend = extend;
        return result;
    },
    makeArray: function (/*dimensions, initializer*/){
        var forward = Array.prototype.slice.call(arguments);
        var result = new Array(forward.shift());
        var i;
        if (forward.length == 1){
            var init = forward[0];
            if (typeof init == "function")
                for(i = 0; i < result.length; ++i)
                    result[i] = init();
            else
                for(i = 0; i < result.length; ++i)
                    result[i] = init;
        }
        else
            for(i = 0; i < result.length; ++i)
                result[i] = this.makeArray.apply(this, forward);
        return result;
    },
    cloneRecord: function (from){
        var Ctr = from.constructor;
        var result = new Ctr();
        this.copyRecord(from, result);
        return result;
    },
    copyRecord: function (from, to){
        for(var prop in to){
            if (to.hasOwnProperty(prop)){
                var v = from[prop];
                var isScalar = prop[0] != "$";
                if (isScalar)
                    to[prop] = v;
                else
                    to[prop] = v instanceof Array ? this.cloneArrayOfRecords(v)
                                                  : this.cloneRecord(v);
            }
        }
    },
    assert: function (condition){
        if (!condition)
            throw new Error("assertion failed");
    }
};
var m = function (){
var Base = RTL$.extend({
	init: function Base(){
	}
});
var Derived = Base.extend({
	init: function Derived(){
		Base.prototype.init.call(this);
		this.derivedField = 0;
	}
});
var r = new Derived();
var pbVar = null;
var pdVar = null;
var i = 0;
var a = RTL$.makeArray(10, 0);

function p(){
	return false;
}

function void$(){
}

function valueArgs(r/*Derived*/, i/*INTEGER*/, a/*ARRAY 10 OF INTEGER*/){
	var v1 = RTL$.cloneRecord(r);
	var v2 = i;
	var v3 = a.slice();
}

function varArgs(r/*VAR Derived*/, i/*VAR INTEGER*/, a/*ARRAY 10 OF INTEGER*/){
	var v1 = RTL$.cloneRecord(r);
	var v2 = i.get();
	var v3 = a.slice();
}

function pChar(c/*CHAR*/){
}

function pCharArray(a/*ARRAY OF CHAR*/){
}

function pString(s/*STRING*/){
}
var v1 = 0;
var v2 = 1.23;
var v3 = "abc";
var vs = "\"";
pChar(vs.charCodeAt(0));
pChar(34);
pCharArray(vs);
pString(vs);
var v4 = true;
var v5 = i;
var v6 = i + i | 0;
var v7 = p();
var v8 = void$;
var do$ = 0;
var tempRecord = RTL$.cloneRecord(r);
var tempArray = a.slice();
pdVar = new Derived();
pbVar = pdVar;
var pb = pbVar;
if (pb instanceof Derived){
	pb.derivedField = 123;
}
RTL$.assert(!(pb instanceof Derived) || pb.derivedField == 123);
for (var j = 0; j <= 10; ++j){
}
}();
