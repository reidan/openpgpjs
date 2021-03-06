// GPG4Browsers - An OpenPGP implementation in javascript
// Copyright (C) 2011 Recurity Labs GmbH
//
// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 3.0 of the License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA

/**
 * @fileoverview The openpgp base module should provide all of the functionality
 * to consume the openpgp.js library. All additional classes are documented
 * for extending and developing on top of the base library.
 */

/**
 * @requires cleartext
 * @requires config
 * @requires encoding/armor
 * @requires enums
 * @requires message
 * @requires packet
 * @module openpgp
 */

'use strict';

var armor = require('./encoding/armor.js'),
  enums = require('./enums.js'),
  message = require('./message.js'),
  cleartext = require('./cleartext.js'),
  key = require('./key.js'),
  util = require('./util'),
  AsyncProxy = require('./worker/async_proxy.js');

if (typeof Promise === 'undefined') {
  // load ES6 Promises polyfill
  require('es6-promise').polyfill();
}

var asyncProxy; // instance of the asyncproxy

/**
 * Set the path for the web worker script and create an instance of the async proxy
 * @param {String} path relative path to the worker scripts
 */
function initWorker(path) {
  asyncProxy = new AsyncProxy(path);
}

/**
 * Encrypts message text with keys
 * @param  {(Array<module:key~Key>|module:key~Key)}  keys array of keys or single key, used to encrypt the message
 * @param  {String} text message as native JavaScript string
 * @return {Promise<String>}      encrypted ASCII armored message
 * @static
 */
function encryptMessage(keys, text) {
  if (!keys.length) {
    keys = [keys];
  }

  if (useWorker()) {
    return asyncProxy.encryptMessage(keys, text);
  }

  return execute(function() {
    var msg, armored;
    msg = message.fromText(text);
    msg = msg.encrypt(keys);
    armored = armor.encode(enums.armor.message, msg.packets.write());
    return armored;

  }, 'Error encrypting message!');
}


/**
 * Encrypts message text with keys and applies filename.  Note: if using web workers, it will default to legacy msg.txt filename
 * @param  {(Array<module:key~Key>|module:key~Key)}  keys array of keys or single key, used to encrypt the message
 * @param  {String} text message as native JavaScript string
 * @param  {String} text filename as native JavaScript string
 * @return {Promise<String>}      encrypted ASCII armored message
 * @static
 */
function encryptMessageWithFilename(keys, text, filename) {
  if (!keys.length) {
    keys = [keys];
  }

  if (useWorker()) {
    return asyncProxy.encryptMessage(keys, text);
  }

  return execute(function() {
    var msg, armored;
    msg = message.fromTextWithFilename(text, filename);
    msg = msg.encrypt(keys);
    armored = armor.encode(enums.armor.message, msg.packets.write());
    return armored;

  }, 'Error encrypting message!');
}

/**
 * Signs message text and encrypts it
 * @param  {(Array<module:key~Key>|module:key~Key)}  publicKeys array of keys or single key, used to encrypt the message
 * @param  {module:key~Key}    privateKey private key with decrypted secret key data for signing
 * @param  {String} text       message as native JavaScript string
 * @return {Promise<String>}   encrypted ASCII armored message
 * @static
 */
function signAndEncryptMessage(publicKeys, privateKey, text) {
  if (!publicKeys.length) {
    publicKeys = [publicKeys];
  }

  if (useWorker()) {
    return asyncProxy.signAndEncryptMessage(publicKeys, privateKey, text);
  }

  return execute(function() {
    var msg, armored;
    msg = message.fromText(text);
    msg = msg.sign([privateKey]);
    msg = msg.encrypt(publicKeys);
    armored = armor.encode(enums.armor.message, msg.packets.write());
    return armored;

  }, 'Error signing and encrypting message!');
}

/**
 * Signs message text and encrypts it
 * @param  {(Array<module:key~Key>|module:key~Key)}  publicKeys array of keys or single key, used to encrypt the message
 * @param  {module:key~Key}    privateKey private key with decrypted secret key data for signing
 * @param  {String} text       message as native JavaScript string
 * @return {Promise<String>}   encrypted ASCII armored message
 * @static
 */
function signAndEncryptMessageWithFilename(publicKeys, privateKey, text, filename) {
  if (!publicKeys.length) {
    publicKeys = [publicKeys];
  }

  if (useWorker()) {
    return asyncProxy.signAndEncryptMessage(publicKeys, privateKey, text);
  }

  return execute(function() {
    var msg, armored;
    msg = message.fromTextWithFilename(text, filename);
    msg = msg.sign([privateKey]);
    msg = msg.encrypt(publicKeys);
    armored = armor.encode(enums.armor.message, msg.packets.write());
    return armored;

  }, 'Error signing and encrypting message!');
}

/**
 * Decrypts message
 * @param  {module:key~Key}                privateKey private key with decrypted secret key data
 * @param  {module:message~Message} msg    the message object with the encrypted data
 * @return {Promise<(String|null)>}        decrypted message as as native JavaScript string
 *                              or null if no literal data found
 * @static
 */
function decryptMessage(privateKey, msg) {
  if (useWorker()) {
    return asyncProxy.decryptMessage(privateKey, msg);
  }

  return execute(function() {
    msg = msg.decrypt(privateKey);
    return msg.getText();

  }, 'Error decrypting message!');
}

/**
 * Decrypts message and verifies signatures
 * @param  {module:key~Key}     privateKey private key with decrypted secret key data
 * @param  {(Array<module:key~Key>|module:key~Key)}  publicKeys array of keys or single key, to verify signatures
 * @param  {module:message~Message} msg    the message object with signed and encrypted data
 * @return {Promise<{text: String, signatures: Array<{keyid: module:type/keyid, valid: Boolean}>}>}
 *                              decrypted message as as native JavaScript string
 *                              with verified signatures or null if no literal data found
 * @static
 */
function decryptAndVerifyMessage(privateKey, publicKeys, msg) {
  if (!publicKeys.length) {
    publicKeys = [publicKeys];
  }

  if (useWorker()) {
    return asyncProxy.decryptAndVerifyMessage(privateKey, publicKeys, msg);
  }

  return execute(function() {
    var result = {};
    msg = msg.decrypt(privateKey);
    result.text = msg.getText();
    if (result.text) {
      result.signatures = msg.verify(publicKeys);
      return result;
    }
    return null;

  }, 'Error decrypting and verifying message!');
}

/**
 * Signs a cleartext message
 * @param  {(Array<module:key~Key>|module:key~Key)}  privateKeys array of keys or single key with decrypted secret key data to sign cleartext
 * @param  {String} text        cleartext
 * @return {Promise<String>}    ASCII armored message
 * @static
 */
function signClearMessage(privateKeys, text) {
  if (!privateKeys.length) {
    privateKeys = [privateKeys];
  }

  if (useWorker()) {
    return asyncProxy.signClearMessage(privateKeys, text);
  }

  return execute(function() {
    var cleartextMessage = new cleartext.CleartextMessage(text);
    cleartextMessage.sign(privateKeys);
    return cleartextMessage.armor();

  }, 'Error signing cleartext message!');
}

/**
 * Verifies signatures of cleartext signed message
 * @param  {(Array<module:key~Key>|module:key~Key)}  publicKeys array of keys or single key, to verify signatures
 * @param  {module:cleartext~CleartextMessage} msg    cleartext message object with signatures
 * @return {Promise<{text: String, signatures: Array<{keyid: module:type/keyid, valid: Boolean}>}>}
 *                                       cleartext with status of verified signatures
 * @static
 */
function verifyClearSignedMessage(publicKeys, msg) {
  if (!publicKeys.length) {
    publicKeys = [publicKeys];
  }

  if (useWorker()) {
    return asyncProxy.verifyClearSignedMessage(publicKeys, msg);
  }

  return execute(function() {
    var result = {};
    if (!(msg instanceof cleartext.CleartextMessage)) {
      throw new Error('Parameter [message] needs to be of type CleartextMessage.');
    }
    result.text = msg.getText();
    result.signatures = msg.verify(publicKeys);
    return result;

  }, 'Error verifying cleartext signed message!');
}

/**
 * Generates a new OpenPGP key pair. Currently only supports RSA keys.
 * Primary and subkey will be of same type.
 * @param {module:enums.publicKey} [options.keyType=module:enums.publicKey.rsa_encrypt_sign]    to indicate what type of key to make.
 *                             RSA is 1. See {@link http://tools.ietf.org/html/rfc4880#section-9.1}
 * @param {Integer} options.numBits    number of bits for the key creation. (should be 1024+, generally)
 * @param {String}  options.userId     assumes already in form of "User Name <username@email.com>"
 * @param {String}  options.passphrase The passphrase used to encrypt the resulting private key
 * @param {Boolean} [options.unlocked=false]    The secret part of the generated key is unlocked
 * @return {Promise<Object>} {key: module:key~Key, privateKeyArmored: String, publicKeyArmored: String}
 * @static
 */
function generateKeyPair(options) {
  // use web worker if web crypto apis are not supported
  if (!util.getWebCrypto() && useWorker()) {
    return asyncProxy.generateKeyPair(options);
  }

  return key.generate(options).then(function(newKey) {
    var result = {};
    result.key = newKey;
    result.privateKeyArmored = newKey.armor();
    result.publicKeyArmored = newKey.toPublic().armor();
    return result;

  }).catch(function(err) {
    console.error(err);

    if (!util.getWebCrypto()) {
      // js fallback already tried
      throw new Error('Error generating keypair using js fallback!');
    }

    // fall back to js keygen in a worker
    console.log('Error generating keypair using native WebCrypto... falling back back to js!');
    return asyncProxy.generateKeyPair(options);

  }).catch(onError.bind(null, 'Error generating keypair!'));
}

//
// helper functions
//

/**
 * Are we in a browser and do we support worker?
 */
function useWorker() {
  if (typeof window === 'undefined' || !window.Worker) {
    return false;
  }

  if (!asyncProxy) {
    console.log('You need to set the worker path!');
    return false;
  }

  return true;
}

/**
 * Command pattern that wraps synchronous code into a promise
 * @param  {function} cmd     The synchronous function with a return value
 *                            to be wrapped in a promise
 * @param  {String}   errMsg  A human readable error Message
 * @return {Promise}          The promise wrapped around cmd
 */
function execute(cmd, errMsg) {
  // wrap the sync cmd in a promise
  var promise = new Promise(function(resolve) {
    var result = cmd();
    resolve(result);
  });

  // handler error globally
  return promise.catch(onError.bind(null, errMsg));
}

/**
 * Global error handler that logs the stack trace and
 *   rethrows a high lvl error message
 * @param  {String} message   A human readable high level error Message
 * @param  {Error}  error     The internal error that caused the failure
 */
function onError(message, error) {
  // log the stack trace
  console.error(error.stack);
  // rethrow new high level error for api users
  throw new Error(message);
}

exports.initWorker = initWorker;
exports.encryptMessage = encryptMessage;
exports.encryptMessageWithFilename = encryptMessageWithFilename;
exports.signAndEncryptMessage = signAndEncryptMessage;
exports.signAndEncryptMessageWithFilename = signAndEncryptMessageWithFilename;
exports.decryptMessage = decryptMessage;
exports.decryptAndVerifyMessage = decryptAndVerifyMessage;
exports.signClearMessage = signClearMessage;
exports.verifyClearSignedMessage = verifyClearSignedMessage;
exports.generateKeyPair = generateKeyPair;
