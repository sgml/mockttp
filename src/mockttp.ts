/**
 * @module Mockttp
 */
import { stripIndent } from "common-tags";

import MockRuleBuilder from "./rules/mock-rule-builder";
import { ProxyConfig, MockedEndpoint, Method, CompletedRequest, CompletedResponse, TlsRequest } from "./types";
import { MockRuleData } from "./rules/mock-rule-types";
import { CAOptions } from './util/tls';

export type PortRange = { startPort: number, endPort: number };

/**
 * A mockttp instance allow you to start and stop mock servers and control their behaviour.
 *
 * Call `.start()` to set up a server on a random port, use methods like `.get(url)`,
 * `.post(url)` and `.anyRequest()` to get a {@link MockRuleBuilder} and start defining
 * mock rules. Call `.stop()` when your test is complete.
 */
export interface Mockttp {
    /**
     * Start a mock server.
     *
     * Specify a fixed port if you need one.
     *
     * If you don't, a random port will be chosen, which you can get later with `.port`,
     * or by using `.url` and `.urlFor(path)` to generate your URLs automatically.
     *
     * If you need to allow port selection, but in a specific range, pass a
     * { startPort, endPort } pair to define the allowed (inclusive) range.
     */
    start(port?: number | PortRange): Promise<void>;

    /**
     * Stop the mock server and reset the rules.
     */
    stop(): Promise<void>;

    /**
     * Enable extra debug output so you can understand exactly what the server is doing.
     */
    enableDebug(): void;

    /**
     * Reset the stored rules. Most of the time it's better to start & stop the server instead,
     * but this can be useful in some special cases.
     */
    reset(): void;

    /**
     * The root URL of the server.
     * 
     * This will throw an error if read before the server is started.
     */
    url: string;

    /**
     * The URL for a given path on the server.
     * 
     * This will throw an error if read before the server is started.
     */
    urlFor(path: string): string;
    /**
     * The port the server is running on.
     * 
     * This will throw an error if read before the server is started.
     */
    port: number;
    /**
     * The environment variables typically needed to use this server as a proxy, in a format you
     * can add to your environment straight away.
     * 
     * This will throw an error if read before the server is started.
     * 
     * ```
     * process.env = Object.assign(process.env, mockServer.proxyEnv)
     * ```
     */
    proxyEnv: ProxyConfig;

    /**
     * Get a builder for a mock rule that will match any requests on any path.
     */
    anyRequest(): MockRuleBuilder;
    /**
     * Get a builder for a mock rule that will match GET requests for the given path.
     * 
     * The path can be either a string, or a regular expression to match against.
     */
    get(url: string | RegExp): MockRuleBuilder;
    /**
     * Get a builder for a mock rule that will match POST requests for the given path.
     * 
     * The path can be either a string, or a regular expression to match against.
     */
    post(url: string | RegExp): MockRuleBuilder;
    /**
     * Get a builder for a mock rule that will match PUT requests for the given path.
     * 
     * The path can be either a string, or a regular expression to match against.
     */
    put(url: string | RegExp): MockRuleBuilder;
    /**
     * Get a builder for a mock rule that will match DELETE requests for the given path.
     * 
     * The path can be either a string, or a regular expression to match against.
     */
    delete(url: string | RegExp): MockRuleBuilder;
    /**
     * Get a builder for a mock rule that will match PATCH requests for the given path.
     * 
     * The path can be either a string, or a regular expression to match against.
     */
    patch(url: string | RegExp): MockRuleBuilder;
    /**
     * Get a builder for a mock rule that will match HEAD requests for the given path.
     * 
     * The path can be either a string, or a regular expression to match against.
     */
    head(url: string | RegExp): MockRuleBuilder;
    /**
     * Get a builder for a mock rule that will match OPTIONS requests for the given path.
     * 
     * The path can be either a string, or a regular expression to match against.
     * 
     * This can only be used if the `cors` option has been set to false.
     * 
     * If cors is true (the default when using a remote client, e.g. in the browser),
     * then the mock server automatically handles OPTIONS requests to ensure requests
     * to the server are allowed by clients observing CORS rules.
     * 
     * You can pass `{cors: false}` to `getLocal`/`getRemote` to disable this behaviour,
     * but if you're testing in a browser you will need to ensure you mock all OPTIONS
     * requests appropriately so that the browser allows your other requests to be sent.
     */
    options(url: string | RegExp): MockRuleBuilder;

    /**
     * Subscribe to hear about request details as they're received.
     *
     * This is only useful in some niche use cases, such as logging all requests seen
     * by the server independently of the rules defined.
     *
     * The callback will be called asynchronously from request handling. This function
     * returns a promise, and the callback is not guaranteed to be registered until
     * the promise is resolved.
     */
    on(event: 'request', callback: (req: CompletedRequest) => void): Promise<void>;

    /**
     * Subscribe to hear about response details when the response is completed.
     *
     * This is only useful in some niche use cases, such as logging all requests seen
     * by the server independently of the rules defined.
     *
     * The callback will be called asynchronously from request handling. This function
     * returns a promise, and the callback is not guaranteed to be registered until
     * the promise is resolved.
     */
    on(event: 'response', callback: (req: CompletedResponse) => void): Promise<void>;

    /**
     * Subscribe to hear about requests that are aborted before the response is completed.
     *
     * This is only useful in some niche use cases, such as logging all requests seen
     * by the server independently of the rules defined.
     *
     * The callback will be called asynchronously from request handling. This function
     * returns a promise, and the callback is not guaranteed to be registered until
     * the promise is resolved.
     */
    on(event: 'abort', callback: (req: CompletedRequest) => void): Promise<void>;

    /**
     * Subscribe to hear about requests that start a TLS handshake, but fail to complete it.
     * Not all clients report TLS errors explicitly, so this event fires for explicitly
     * reported TLS errors, and for TLS connections that are immediately closed with no
     * data sent.
     *
     * This is typically useful to detect clients who aren't correctly configured to trust
     * the configured HTTPS certificate. The callback is given the host name provided
     * by the client via SNI, if SNI was used (it almost always is).
     *
     * This is only useful in some niche use cases, such as logging all requests seen
     * by the server, independently of the rules defined.
     *
     * The callback will be called asynchronously from request handling. This function
     * returns a promise, and the callback is not guaranteed to be registered until
     * the promise is resolved.
     */
    on(event: 'tlsClientError', callback: (req: TlsRequest) => void): Promise<void>;
}

export interface MockttpOptions {
    /**
     * Should the server automatically respond to OPTIONS requests with a permissive
     * response?
     *
     * Defaults to true for remote clients (e.g. in the browser), and false otherwise.
     * If this is set to false, browser requests will typically fail unless you 
     * stub OPTIONS responses by hand.
     */
    cors?: boolean;

    /**
     * Should the server print extra debug information?
     */
    debug?: boolean;

    /**
     * The HTTPS settings to be used. Optional, only HTTP interception will be
     * enabled if omitted. This should be set to either a { key, cert } object
     * containing the private key and certificate in PEM format, or a { keyPath,
     * certPath } object containing the path to files containing that content.
     */
    https?: CAOptions;

    /**
     * The full URL to use for a standalone server with remote (or local but browser) client.
     * When using a local server, this parameter is ignored.
     */
    standaloneServerUrl?: string;
}

/**
 * @hidden
 */
export abstract class AbstractMockttp {
    protected cors: boolean;
    protected debug: boolean;

    abstract get url(): string;
    abstract addRule: (ruleData: MockRuleData) => Promise<MockedEndpoint>;
    abstract on(event: 'request', callback: (req: CompletedRequest) => void): Promise<void>;

    constructor(options: MockttpOptions) {
        this.debug = options.debug || false;
        this.cors = options.cors || false;
    }

    get proxyEnv(): ProxyConfig {
        return {
            HTTP_PROXY: this.url,
            HTTPS_PROXY: this.url
        }
    }

    urlFor(path: string): string {
        return this.url + path;
    }

    anyRequest(): MockRuleBuilder {
        return new MockRuleBuilder(this.addRule);
    }

    get(url: string | RegExp): MockRuleBuilder {
        return new MockRuleBuilder(Method.GET, url, this.addRule);
    }

    post(url: string | RegExp): MockRuleBuilder {
        return new MockRuleBuilder(Method.POST, url, this.addRule);
    }

    put(url: string | RegExp): MockRuleBuilder {
        return new MockRuleBuilder(Method.PUT, url, this.addRule);
    }

    delete(url: string | RegExp): MockRuleBuilder {
        return new MockRuleBuilder(Method.DELETE, url, this.addRule);
    }

    patch(url: string | RegExp): MockRuleBuilder {
        return new MockRuleBuilder(Method.PATCH, url, this.addRule);
    }

    head(url: string | RegExp): MockRuleBuilder {
        return new MockRuleBuilder(Method.HEAD, url, this.addRule);
    }

    options(url: string | RegExp): MockRuleBuilder {
        if (this.cors) {
            throw new Error(stripIndent`
                Cannot mock OPTIONS requests with CORS enabled.

                You can disable CORS by passing { cors: false } to getLocal/getRemote, but this may cause issues ${''
                }connecting to your mock server from browsers, unless you mock all required OPTIONS preflight ${''
                }responses by hand.
            `);
        }
        return new MockRuleBuilder(Method.OPTIONS, url, this.addRule);
    }

}