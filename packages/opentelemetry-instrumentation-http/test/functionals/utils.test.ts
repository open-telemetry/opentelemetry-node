/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  SpanAttributes,
  SpanStatusCode,
  ROOT_CONTEXT,
  SpanKind,
  TraceFlags,
} from '@opentelemetry/api';
import { BasicTracerProvider, Span } from '@opentelemetry/tracing';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import * as assert from 'assert';
import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import * as sinon from 'sinon';
import * as url from 'url';
import { IgnoreMatcher } from '../../src/types';
import * as utils from '../../src/utils';
import { AttributeNames } from '../../src/enums/AttributeNames';

describe('Utility', () => {
  describe('parseResponseStatus()', () => {
    it('should return ERROR code by default', () => {
      const status = utils.parseResponseStatus(
        (undefined as unknown) as number
      );
      assert.deepStrictEqual(status, { code: SpanStatusCode.ERROR });
    });

    it('should return OK for Success HTTP status code', () => {
      for (let index = 100; index < 400; index++) {
        const status = utils.parseResponseStatus(index);
        assert.deepStrictEqual(status, { code: SpanStatusCode.OK });
      }
    });

    it('should not return OK for Bad HTTP status code', () => {
      for (let index = 400; index <= 600; index++) {
        const status = utils.parseResponseStatus(index);
        assert.notStrictEqual(status.code, SpanStatusCode.OK);
      }
    });
  });
  describe('hasExpectHeader()', () => {
    it('should throw if no option', () => {
      try {
        utils.hasExpectHeader('' as http.RequestOptions);
        assert.fail();
      } catch (ignore) {}
    });

    it('should not throw if no headers', () => {
      const result = utils.hasExpectHeader({} as http.RequestOptions);
      assert.strictEqual(result, false);
    });

    it('should return true on Expect (no case sensitive)', () => {
      for (const headers of [{ Expect: 1 }, { expect: 1 }, { ExPect: 1 }]) {
        const result = utils.hasExpectHeader({
          headers,
        } as http.RequestOptions);
        assert.strictEqual(result, true);
      }
    });
  });

  describe('getRequestInfo()', () => {
    it('should get options object', () => {
      const webUrl = 'http://u:p@google.fr/aPath?qu=ry';
      const urlParsed = url.parse(webUrl);
      const urlParsedWithoutPathname = {
        ...urlParsed,
        pathname: undefined,
      };
      const whatWgUrl = new url.URL(webUrl);
      for (const param of [
        webUrl,
        urlParsed,
        urlParsedWithoutPathname,
        whatWgUrl,
      ]) {
        const result = utils.getRequestInfo(param);
        assert.strictEqual(result.optionsParsed.hostname, 'google.fr');
        assert.strictEqual(result.optionsParsed.protocol, 'http:');
        assert.strictEqual(result.optionsParsed.path, '/aPath?qu=ry');
        assert.strictEqual(result.pathname, '/aPath');
        assert.strictEqual(result.origin, 'http://google.fr');
      }
    });
  });

  describe('satisfiesPattern()', () => {
    it('string pattern', () => {
      const answer1 = utils.satisfiesPattern('/test/1', '/test/1');
      assert.strictEqual(answer1, true);
      const answer2 = utils.satisfiesPattern('/test/1', '/test/11');
      assert.strictEqual(answer2, false);
    });

    it('regex pattern', () => {
      const answer1 = utils.satisfiesPattern('/TeSt/1', /\/test/i);
      assert.strictEqual(answer1, true);
      const answer2 = utils.satisfiesPattern('/2/tEst/1', /\/test/);
      assert.strictEqual(answer2, false);
    });

    it('should throw if type is unknown', () => {
      try {
        utils.satisfiesPattern('/TeSt/1', (true as unknown) as IgnoreMatcher);
        assert.fail();
      } catch (error) {
        assert.strictEqual(error instanceof TypeError, true);
      }
    });

    it('function pattern', () => {
      const answer1 = utils.satisfiesPattern(
        '/test/home',
        (url: string) => url === '/test/home'
      );
      assert.strictEqual(answer1, true);
      const answer2 = utils.satisfiesPattern(
        '/test/home',
        (url: string) => url !== '/test/home'
      );
      assert.strictEqual(answer2, false);
    });
  });

  describe('isIgnored()', () => {
    beforeEach(() => {
      sinon.spy(utils, 'satisfiesPattern');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should call isSatisfyPattern, n match', () => {
      const answer1 = utils.isIgnored('/test/1', ['/test/11']);
      assert.strictEqual(answer1, false);
      assert.strictEqual(
        (utils.satisfiesPattern as sinon.SinonSpy).callCount,
        1
      );
    });

    it('should call isSatisfyPattern, match for function', () => {
      const answer1 = utils.isIgnored('/test/1', [
        url => url.endsWith('/test/1'),
      ]);
      assert.strictEqual(answer1, true);
    });

    it('should not re-throw when function throws an exception', () => {
      const onException = (e: Error) => {
        // Do nothing
      };
      for (const callback of [undefined, onException]) {
        assert.doesNotThrow(() =>
          utils.isIgnored(
            '/test/1',
            [
              () => {
                throw new Error('test');
              },
            ],
            callback
          )
        );
      }
    });

    it('should call onException when function throws an exception', () => {
      const onException = sinon.spy();
      assert.doesNotThrow(() =>
        utils.isIgnored(
          '/test/1',
          [
            () => {
              throw new Error('test');
            },
          ],
          onException
        )
      );
      assert.strictEqual((onException as sinon.SinonSpy).callCount, 1);
    });

    it('should not call isSatisfyPattern', () => {
      utils.isIgnored('/test/1', []);
      assert.strictEqual(
        (utils.satisfiesPattern as sinon.SinonSpy).callCount,
        0
      );
    });

    it('should return false on empty list', () => {
      const answer1 = utils.isIgnored('/test/1', []);
      assert.strictEqual(answer1, false);
    });

    it('should not throw and return false when list is undefined', () => {
      const answer2 = utils.isIgnored('/test/1', undefined);
      assert.strictEqual(answer2, false);
    });
  });

  describe('getAbsoluteUrl()', () => {
    it('should return absolute url with localhost', () => {
      const path = '/test/1';
      const result = utils.getAbsoluteUrl(url.parse(path), {});
      assert.strictEqual(result, `http://localhost${path}`);
    });
    it('should return absolute url', () => {
      const absUrl = 'http://www.google/test/1?query=1';
      const result = utils.getAbsoluteUrl(url.parse(absUrl), {});
      assert.strictEqual(result, absUrl);
    });
    it('should return default url', () => {
      const result = utils.getAbsoluteUrl(null, {});
      assert.strictEqual(result, 'http://localhost/');
    });
    it("{ path: '/helloworld', port: 8080 } should return http://localhost:8080/helloworld", () => {
      const result = utils.getAbsoluteUrl(
        { path: '/helloworld', port: 8080 },
        {}
      );
      assert.strictEqual(result, 'http://localhost:8080/helloworld');
    });
  });

  describe('setSpanWithError()', () => {
    it('should have error attributes', () => {
      const errorMessage = 'test error';
      for (const obj of [undefined, { statusCode: 400 }]) {
        const span = new Span(
          new BasicTracerProvider().getTracer('default'),
          ROOT_CONTEXT,
          'test',
          { spanId: '', traceId: '', traceFlags: TraceFlags.SAMPLED },
          SpanKind.INTERNAL
        );
        /* tslint:disable-next-line:no-any */
        utils.setSpanWithError(span, new Error(errorMessage), obj as any);
        const attributes = span.attributes;
        assert.strictEqual(
          attributes[AttributeNames.HTTP_ERROR_MESSAGE],
          errorMessage
        );
        assert.ok(attributes[AttributeNames.HTTP_ERROR_NAME]);
      }
    });
  });

  describe('isValidOptionsType()', () => {
    ['', false, true, 1, 0, []].forEach(options => {
      it(`should return false with the following value: ${JSON.stringify(
        options
      )}`, () => {
        assert.strictEqual(utils.isValidOptionsType(options), false);
      });
    });
    for (const options of ['url', url.parse('http://url.com'), {}]) {
      it(`should return true with the following value: ${JSON.stringify(
        options
      )}`, () => {
        assert.strictEqual(utils.isValidOptionsType(options), true);
      });
    }
  });

  describe('getIncomingRequestAttributesOnResponse()', () => {
    it('should correctly parse the middleware stack if present', () => {
      const request = {
        __ot_middlewares: ['/test', '/toto', '/'],
        socket: {},
      } as IncomingMessage & { __ot_middlewares?: string[] };

      const attributes = utils.getIncomingRequestAttributesOnResponse(request, {
        socket: {},
      } as ServerResponse & { socket: Socket });
      assert.deepEqual(attributes[SemanticAttributes.HTTP_ROUTE], '/test/toto');
    });

    it('should succesfully process without middleware stack', () => {
      const request = {
        socket: {},
      } as IncomingMessage;
      const attributes = utils.getIncomingRequestAttributesOnResponse(request, {
        socket: {},
      } as ServerResponse & { socket: Socket });
      assert.deepEqual(attributes[SemanticAttributes.HTTP_ROUTE], undefined);
    });
  });
  // Verify the key in the given attributes is set to the given value,
  // and that no other HTTP Content Length attributes are set.
  function verifyValueInAttributes(
    attributes: SpanAttributes,
    key: string | undefined,
    value: number
  ) {
    const SemanticAttributess = [
      SemanticAttributes.HTTP_RESPONSE_CONTENT_LENGTH_UNCOMPRESSED,
      SemanticAttributes.HTTP_RESPONSE_CONTENT_LENGTH,
      SemanticAttributes.HTTP_REQUEST_CONTENT_LENGTH_UNCOMPRESSED,
      SemanticAttributes.HTTP_REQUEST_CONTENT_LENGTH,
    ];

    for (const attr of SemanticAttributess) {
      if (attr === key) {
        assert.strictEqual(attributes[attr], value);
      } else {
        assert.strictEqual(attributes[attr], undefined);
      }
    }
  }

  describe('setRequestContentLengthAttributes()', () => {
    it('should set request content-length uncompressed attribute with no content-encoding header', () => {
      const attributes: SpanAttributes = {};
      const request = {} as IncomingMessage;

      request.headers = {
        'content-length': '1200',
      };
      utils.setRequestContentLengthAttribute(request, attributes);

      verifyValueInAttributes(
        attributes,
        SemanticAttributes.HTTP_REQUEST_CONTENT_LENGTH_UNCOMPRESSED,
        1200
      );
    });

    it('should set request content-length uncompressed attribute with "identity" content-encoding header', () => {
      const attributes: SpanAttributes = {};
      const request = {} as IncomingMessage;
      request.headers = {
        'content-length': '1200',
        'content-encoding': 'identity',
      };
      utils.setRequestContentLengthAttribute(request, attributes);

      verifyValueInAttributes(
        attributes,
        SemanticAttributes.HTTP_REQUEST_CONTENT_LENGTH_UNCOMPRESSED,
        1200
      );
    });

    it('should set request content-length compressed attribute with "gzip" content-encoding header', () => {
      const attributes: SpanAttributes = {};
      const request = {} as IncomingMessage;
      request.headers = {
        'content-length': '1200',
        'content-encoding': 'gzip',
      };
      utils.setRequestContentLengthAttribute(request, attributes);

      verifyValueInAttributes(
        attributes,
        SemanticAttributes.HTTP_REQUEST_CONTENT_LENGTH,
        1200
      );
    });
  });

  describe('setResponseContentLengthAttributes()', () => {
    it('should set response content-length uncompressed attribute with no content-encoding header', () => {
      const attributes: SpanAttributes = {};

      const response = {} as IncomingMessage;

      response.headers = {
        'content-length': '1200',
      };
      utils.setResponseContentLengthAttribute(response, attributes);

      verifyValueInAttributes(
        attributes,
        SemanticAttributes.HTTP_RESPONSE_CONTENT_LENGTH_UNCOMPRESSED,
        1200
      );
    });

    it('should set response content-length uncompressed attribute with "identity" content-encoding header', () => {
      const attributes: SpanAttributes = {};

      const response = {} as IncomingMessage;

      response.headers = {
        'content-length': '1200',
        'content-encoding': 'identity',
      };

      utils.setResponseContentLengthAttribute(response, attributes);

      verifyValueInAttributes(
        attributes,
        SemanticAttributes.HTTP_RESPONSE_CONTENT_LENGTH_UNCOMPRESSED,
        1200
      );
    });

    it('should set response content-length compressed attribute with "gzip" content-encoding header', () => {
      const attributes: SpanAttributes = {};

      const response = {} as IncomingMessage;

      response.headers = {
        'content-length': '1200',
        'content-encoding': 'gzip',
      };

      utils.setResponseContentLengthAttribute(response, attributes);

      verifyValueInAttributes(
        attributes,
        SemanticAttributes.HTTP_RESPONSE_CONTENT_LENGTH,
        1200
      );
    });

    it('should set no attributes with no content-length header', () => {
      const attributes: SpanAttributes = {};
      const message = {} as IncomingMessage;

      message.headers = {
        'content-encoding': 'gzip',
      };
      utils.setResponseContentLengthAttribute(message, attributes);

      verifyValueInAttributes(attributes, undefined, 1200);
    });
  });
});
