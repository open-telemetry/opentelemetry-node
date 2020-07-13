// source: opentelemetry/proto/common/v1/common.proto
/**
 * @fileoverview
 * @enhanceable
 * @suppress {messageConventions} JS Compiler reports an error if a variable or
 *     field starts with 'MSG_' and isn't a translatable message.
 * @public
 */
// GENERATED CODE -- DO NOT EDIT!

var jspb = require('google-protobuf');
var goog = jspb;
var global = Function('return this')();

goog.exportSymbol('proto.opentelemetry.proto.common.v1.AttributeKeyValue', null, global);
goog.exportSymbol('proto.opentelemetry.proto.common.v1.AttributeKeyValue.ValueType', null, global);
goog.exportSymbol('proto.opentelemetry.proto.common.v1.InstrumentationLibrary', null, global);
goog.exportSymbol('proto.opentelemetry.proto.common.v1.StringKeyValue', null, global);
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.opentelemetry.proto.common.v1.AttributeKeyValue, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.opentelemetry.proto.common.v1.AttributeKeyValue.displayName = 'proto.opentelemetry.proto.common.v1.AttributeKeyValue';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.opentelemetry.proto.common.v1.StringKeyValue = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.opentelemetry.proto.common.v1.StringKeyValue, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.opentelemetry.proto.common.v1.StringKeyValue.displayName = 'proto.opentelemetry.proto.common.v1.StringKeyValue';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.opentelemetry.proto.common.v1.InstrumentationLibrary = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.opentelemetry.proto.common.v1.InstrumentationLibrary, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.opentelemetry.proto.common.v1.InstrumentationLibrary.displayName = 'proto.opentelemetry.proto.common.v1.InstrumentationLibrary';
}



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.toObject = function(opt_includeInstance) {
  return proto.opentelemetry.proto.common.v1.AttributeKeyValue.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.opentelemetry.proto.common.v1.AttributeKeyValue} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.toObject = function(includeInstance, msg) {
  var f, obj = {
    key: jspb.Message.getFieldWithDefault(msg, 1, ""),
    type: jspb.Message.getFieldWithDefault(msg, 2, 0),
    stringValue: jspb.Message.getFieldWithDefault(msg, 3, ""),
    intValue: jspb.Message.getFieldWithDefault(msg, 4, 0),
    doubleValue: jspb.Message.getFloatingPointFieldWithDefault(msg, 5, 0.0),
    boolValue: jspb.Message.getBooleanFieldWithDefault(msg, 6, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.opentelemetry.proto.common.v1.AttributeKeyValue}
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.opentelemetry.proto.common.v1.AttributeKeyValue;
  return proto.opentelemetry.proto.common.v1.AttributeKeyValue.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.opentelemetry.proto.common.v1.AttributeKeyValue} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.opentelemetry.proto.common.v1.AttributeKeyValue}
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setKey(value);
      break;
    case 2:
      var value = /** @type {!proto.opentelemetry.proto.common.v1.AttributeKeyValue.ValueType} */ (reader.readEnum());
      msg.setType(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setStringValue(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setIntValue(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setDoubleValue(value);
      break;
    case 6:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setBoolValue(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.opentelemetry.proto.common.v1.AttributeKeyValue.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.opentelemetry.proto.common.v1.AttributeKeyValue} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getKey();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getType();
  if (f !== 0.0) {
    writer.writeEnum(
      2,
      f
    );
  }
  f = message.getStringValue();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getIntValue();
  if (f !== 0) {
    writer.writeInt64(
      4,
      f
    );
  }
  f = message.getDoubleValue();
  if (f !== 0.0) {
    writer.writeDouble(
      5,
      f
    );
  }
  f = message.getBoolValue();
  if (f) {
    writer.writeBool(
      6,
      f
    );
  }
};


/**
 * @enum {number}
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.ValueType = {
  STRING: 0,
  INT: 1,
  DOUBLE: 2,
  BOOL: 3
};

/**
 * optional string key = 1;
 * @return {string}
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.getKey = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.opentelemetry.proto.common.v1.AttributeKeyValue} returns this
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.setKey = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional ValueType type = 2;
 * @return {!proto.opentelemetry.proto.common.v1.AttributeKeyValue.ValueType}
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.getType = function() {
  return /** @type {!proto.opentelemetry.proto.common.v1.AttributeKeyValue.ValueType} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {!proto.opentelemetry.proto.common.v1.AttributeKeyValue.ValueType} value
 * @return {!proto.opentelemetry.proto.common.v1.AttributeKeyValue} returns this
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.setType = function(value) {
  return jspb.Message.setProto3EnumField(this, 2, value);
};


/**
 * optional string string_value = 3;
 * @return {string}
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.getStringValue = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.opentelemetry.proto.common.v1.AttributeKeyValue} returns this
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.setStringValue = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional int64 int_value = 4;
 * @return {number}
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.getIntValue = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.opentelemetry.proto.common.v1.AttributeKeyValue} returns this
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.setIntValue = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};


/**
 * optional double double_value = 5;
 * @return {number}
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.getDoubleValue = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 5, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.opentelemetry.proto.common.v1.AttributeKeyValue} returns this
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.setDoubleValue = function(value) {
  return jspb.Message.setProto3FloatField(this, 5, value);
};


/**
 * optional bool bool_value = 6;
 * @return {boolean}
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.getBoolValue = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 6, false));
};


/**
 * @param {boolean} value
 * @return {!proto.opentelemetry.proto.common.v1.AttributeKeyValue} returns this
 */
proto.opentelemetry.proto.common.v1.AttributeKeyValue.prototype.setBoolValue = function(value) {
  return jspb.Message.setProto3BooleanField(this, 6, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.opentelemetry.proto.common.v1.StringKeyValue.prototype.toObject = function(opt_includeInstance) {
  return proto.opentelemetry.proto.common.v1.StringKeyValue.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.opentelemetry.proto.common.v1.StringKeyValue} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.opentelemetry.proto.common.v1.StringKeyValue.toObject = function(includeInstance, msg) {
  var f, obj = {
    key: jspb.Message.getFieldWithDefault(msg, 1, ""),
    value: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.opentelemetry.proto.common.v1.StringKeyValue}
 */
proto.opentelemetry.proto.common.v1.StringKeyValue.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.opentelemetry.proto.common.v1.StringKeyValue;
  return proto.opentelemetry.proto.common.v1.StringKeyValue.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.opentelemetry.proto.common.v1.StringKeyValue} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.opentelemetry.proto.common.v1.StringKeyValue}
 */
proto.opentelemetry.proto.common.v1.StringKeyValue.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setKey(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setValue(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.opentelemetry.proto.common.v1.StringKeyValue.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.opentelemetry.proto.common.v1.StringKeyValue.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.opentelemetry.proto.common.v1.StringKeyValue} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.opentelemetry.proto.common.v1.StringKeyValue.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getKey();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getValue();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional string key = 1;
 * @return {string}
 */
proto.opentelemetry.proto.common.v1.StringKeyValue.prototype.getKey = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.opentelemetry.proto.common.v1.StringKeyValue} returns this
 */
proto.opentelemetry.proto.common.v1.StringKeyValue.prototype.setKey = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string value = 2;
 * @return {string}
 */
proto.opentelemetry.proto.common.v1.StringKeyValue.prototype.getValue = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.opentelemetry.proto.common.v1.StringKeyValue} returns this
 */
proto.opentelemetry.proto.common.v1.StringKeyValue.prototype.setValue = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.opentelemetry.proto.common.v1.InstrumentationLibrary.prototype.toObject = function(opt_includeInstance) {
  return proto.opentelemetry.proto.common.v1.InstrumentationLibrary.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.opentelemetry.proto.common.v1.InstrumentationLibrary} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.opentelemetry.proto.common.v1.InstrumentationLibrary.toObject = function(includeInstance, msg) {
  var f, obj = {
    name: jspb.Message.getFieldWithDefault(msg, 1, ""),
    version: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.opentelemetry.proto.common.v1.InstrumentationLibrary}
 */
proto.opentelemetry.proto.common.v1.InstrumentationLibrary.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.opentelemetry.proto.common.v1.InstrumentationLibrary;
  return proto.opentelemetry.proto.common.v1.InstrumentationLibrary.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.opentelemetry.proto.common.v1.InstrumentationLibrary} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.opentelemetry.proto.common.v1.InstrumentationLibrary}
 */
proto.opentelemetry.proto.common.v1.InstrumentationLibrary.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setName(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setVersion(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.opentelemetry.proto.common.v1.InstrumentationLibrary.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.opentelemetry.proto.common.v1.InstrumentationLibrary.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.opentelemetry.proto.common.v1.InstrumentationLibrary} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.opentelemetry.proto.common.v1.InstrumentationLibrary.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getName();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getVersion();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional string name = 1;
 * @return {string}
 */
proto.opentelemetry.proto.common.v1.InstrumentationLibrary.prototype.getName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.opentelemetry.proto.common.v1.InstrumentationLibrary} returns this
 */
proto.opentelemetry.proto.common.v1.InstrumentationLibrary.prototype.setName = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string version = 2;
 * @return {string}
 */
proto.opentelemetry.proto.common.v1.InstrumentationLibrary.prototype.getVersion = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.opentelemetry.proto.common.v1.InstrumentationLibrary} returns this
 */
proto.opentelemetry.proto.common.v1.InstrumentationLibrary.prototype.setVersion = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


goog.object.extend(exports, proto.opentelemetry.proto.common.v1);