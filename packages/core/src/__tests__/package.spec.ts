import 'jest-extended';
import os from 'os';
import path from 'path';
import loadJsonFile from 'load-json-file';
import npa from 'npm-package-arg';
import writePkg from 'write-pkg';

jest.mock('load-json-file');
jest.mock('write-pkg');

// file under test
import { Package } from '../package';
import { NpaResolveResult, RawManifest } from '../models';

describe('Package', () => {
  const factory = (json) =>
    new Package(json, path.normalize(`/root/path/to/${json.name || 'package'}`), path.normalize('/root'));

  describe('get .name', () => {
    it('should return the name', () => {
      const pkg = factory({ name: 'get-name' });
      expect(pkg.name).toBe('get-name');
    });
  });

  describe('get .location', () => {
    it('should return the location', () => {
      const pkg = factory({ name: 'get-location' });
      expect(pkg.location).toBe(path.normalize('/root/path/to/get-location'));
    });
  });

  describe('get .workspaces', () => {
    it('should return the workspaces', () => {
      const pkg = factory({ name: 'get-workspaces' });
      expect(pkg.workspaces).toBe(undefined);

      pkg.workspaces = ['modules/*'];
      expect(pkg.workspaces).toEqual(['modules/*']);
    });
  });

  describe('get .resolved', () => {
    it('returns npa.Result relative to rootPath, always posix', () => {
      const pkg = factory({ name: 'get-resolved' });
      expect(pkg.resolved).toMatchObject({
        type: 'directory',
        name: 'get-resolved',
        where: path.normalize('/root'),
        // windows is so fucking ridiculous
        fetchSpec: path.resolve(os.homedir(), pkg.location),
      });
    });
  });

  describe('get .rootPath', () => {
    it('should return the rootPath', () => {
      const pkg = factory({ name: 'get-rootPath' });
      expect(pkg.rootPath).toBe(path.normalize('/root'));
    });
  });

  describe('get .version', () => {
    it('should return the version', () => {
      const pkg = factory({ version: '1.0.0' });
      expect(pkg.version).toBe('1.0.0');
    });
  });

  describe('set .version', () => {
    it('should set the version', () => {
      const pkg = factory({ version: '1.0.0' });
      pkg.version = '2.0.0';
      expect(pkg.version).toBe('2.0.0');
    });
  });

  describe('get .contents', () => {
    it('returns pkg.location by default', () => {
      const pkg = factory({ version: '1.0.0' });
      expect(pkg.contents).toBe(path.normalize('/root/path/to/package'));
    });

    it('returns pkg.publishConfig.directory when present', () => {
      const pkg = factory({
        version: '1.0.0',
        publishConfig: {
          directory: 'dist',
        },
      });
      expect(pkg.contents).toBe(path.normalize('/root/path/to/package/dist'));
    });

    it('returns pkg.location when pkg.publishConfig.directory is not present', () => {
      const pkg = factory({
        version: '1.0.0',
        publishConfig: {
          tag: 'next',
        },
      });
      expect(pkg.contents).toBe(path.normalize('/root/path/to/package'));
    });
  });

  describe('set .contents', () => {
    it('sets pkg.contents to joined value', () => {
      const pkg = factory({ version: '1.0.0' });
      pkg.contents = 'dist';
      expect(pkg.contents).toBe(path.normalize('/root/path/to/package/dist'));
    });
  });

  describe('get .pkg', () => {
    it('should return the same package name', () => {
      const pkg = factory({
        name: 'obj-bin',
        bin: { 'custom-bin': 'bin.js' },
      });
      expect(pkg.pkg.name).toBe('obj-bin');
    });
  });

  describe('get .bin', () => {
    it('should return the bin object', () => {
      const pkg = factory({
        name: 'obj-bin',
        bin: { 'custom-bin': 'bin.js' },
      });
      expect(pkg.bin).toEqual({ 'custom-bin': 'bin.js' });
    });

    it('returns a normalized object when pkg.bin is a string', () => {
      const pkg = factory({
        name: 'string-bin',
        bin: 'bin.js',
      });
      expect(pkg.bin).toEqual({ 'string-bin': 'bin.js' });
    });

    it('strips scope from normalized bin name', () => {
      const pkg = factory({
        name: '@scoped/string-bin',
        bin: 'bin.js',
      });
      expect(pkg.bin).toEqual({ 'string-bin': 'bin.js' });
    });
  });

  describe('get .binLocation', () => {
    it('should return the bin location', () => {
      const pkg = factory({
        name: 'obj-bin',
        bin: { 'custom-bin': 'bin.js' },
      });
      expect(pkg.binLocation).toInclude('obj-bin');
    });
  });

  describe('get .nodeModulesLocation', () => {
    it('should return the bin location', () => {
      const pkg = factory({
        name: 'obj-bin',
        bin: { 'custom-bin': 'bin.js' },
      });
      expect(pkg.nodeModulesLocation).toInclude('node_modules');
    });
  });

  describe('get .dependencies', () => {
    it('should return the dependencies', () => {
      const pkg = factory({
        dependencies: { 'my-dependency': '^1.0.0' },
      });
      expect(pkg.dependencies).toEqual({ 'my-dependency': '^1.0.0' });
    });
  });

  describe('get .devDependencies', () => {
    it('should return the devDependencies', () => {
      const pkg = factory({
        devDependencies: { 'my-dev-dependency': '^1.0.0' },
      });
      expect(pkg.devDependencies).toEqual({ 'my-dev-dependency': '^1.0.0' });
    });
  });

  describe('get .optionalDependencies', () => {
    it('should return the optionalDependencies', () => {
      const pkg = factory({
        optionalDependencies: { 'my-optional-dependency': '^1.0.0' },
      });
      expect(pkg.optionalDependencies).toEqual({ 'my-optional-dependency': '^1.0.0' });
    });
  });

  describe('get .peerDependencies', () => {
    it('should return the peerDependencies', () => {
      const pkg = factory({
        peerDependencies: { 'my-peer-dependency': '>=1.0.0' },
      });
      expect(pkg.peerDependencies).toEqual({ 'my-peer-dependency': '>=1.0.0' });
    });
  });

  describe('get .scripts', () => {
    it('should return the scripts', () => {
      const pkg = factory({
        scripts: { 'my-script': 'echo "hello world"' },
      });
      expect(pkg.scripts).toEqual({
        'my-script': 'echo "hello world"',
      });
    });

    it('preserves immutability of the input', () => {
      const json = {
        scripts: { 'my-script': 'keep' },
      };
      const pkg = factory(json);

      pkg.scripts['my-script'] = 'tweaked';

      expect(pkg.scripts).toHaveProperty('my-script', 'tweaked');
      expect(json.scripts).toHaveProperty('my-script', 'keep');
    });
  });

  describe('get .private', () => {
    it('should indicate if the package is private', () => {
      const pkg = factory({ name: 'not-private' });
      expect(pkg.private).toBe(false);
    });
  });

  describe('.get()', () => {
    it('retrieves arbitrary values from manifest', () => {
      const pkg = factory({ name: 'gettable', 'my-value': 'foo' });

      expect(pkg.get('missing')).toBe(undefined);
      expect(pkg.get('my-value')).toBe('foo');
    });
  });

  describe('.set()', () => {
    it('stores arbitrary values on manifest', () => {
      const pkg = factory({ name: 'settable' });

      pkg.set('foo', 'bar');

      expect(pkg.toJSON()).toEqual({
        name: 'settable',
        foo: 'bar',
      });
    });

    it('is chainable', () => {
      const pkg = factory({ name: 'chainable' });

      expect(pkg.set('foo', true).set('bar', false).get('foo')).toBe(true);
    });
  });

  describe('.toJSON()', () => {
    it('should return clone of internal package for serialization', () => {
      const json = {
        name: 'is-cloned',
      };
      const pkg = factory(json);

      expect(pkg.toJSON()).not.toBe(json);
      expect(pkg.toJSON()).toEqual(json);

      const implicit = JSON.stringify(pkg, null, 2);
      const explicit = JSON.stringify(json, null, 2);

      expect(implicit).toBe(explicit);
    });
  });

  describe('.refresh()', () => {
    it('reloads private state from disk', async () => {
      (loadJsonFile as any).mockImplementationOnce(() => Promise.resolve({ name: 'ignored', mutated: true }));

      const pkg = factory({ name: 'refresh' });
      const result = await pkg.refresh();

      expect(result).toBe(pkg);
      // a package's name never changes
      expect(pkg.name).toBe('refresh');
      expect(pkg.get('mutated')).toBe(true);
      expect(loadJsonFile).toHaveBeenLastCalledWith(pkg.manifestLocation);
    });
  });

  describe('.serialize()', () => {
    it('writes changes to disk', async () => {
      (writePkg as any).mockImplementation(() => Promise.resolve());

      const pkg = factory({ name: 'serialize-me' });
      const result = await pkg.set('woo', 'hoo').serialize();

      expect(result).toBe(pkg);
      expect(writePkg).toHaveBeenLastCalledWith(
        pkg.manifestLocation,
        expect.objectContaining({
          name: 'serialize-me',
          woo: 'hoo',
        })
      );
    });
  });

  describe(".updateLocalDependency()", () => {
    describe('gitCommittish', () => {
      it("works with a resolved 'gitCommittish'", () => {
        const pkg = factory({
          dependencies: {
            a: "^1.0.0",
            b: "^1.0.0",
          },
        });

        const resolved: NpaResolveResult = npa.resolve("a", "^1.0.0", ".");
        resolved.explicitWorkspace = true;
        resolved.type = undefined;
        resolved.registry = undefined;
        resolved.gitCommittish = '1.2.3';
        resolved.hosted = { committish: '', domain: 'localhost', noGitPlus: false, noCommittish: false, saveSpec: true } as any;

        pkg.updateLocalDependency(resolved, "2.0.0", "^");

        expect((resolved.hosted as any).committish).toBe('2.0.0');
      });
    });

    describe('gitRange', () => {
      it("works with a resolved 'gitRange'", () => {
        const pkg = factory({
          dependencies: {
            a: "^1.0.0",
            b: "^1.0.0",
          },
        });

        const resolved: NpaResolveResult = npa.resolve("a", "^1.0.0", ".");
        resolved.explicitWorkspace = true;
        resolved.type = undefined;
        resolved.registry = undefined;
        resolved.gitRange = '1.2.3';
        resolved.hosted = { committish: '', domain: 'localhost', noGitPlus: false, noCommittish: false, saveSpec: true } as any;

        pkg.updateLocalDependency(resolved, "2.0.0", "^");

        expect((resolved.hosted as any).committish).toBe('semver:^2.0.0');
      });
    });

    describe('Version with `workspace:` protocol', () => {
      it("works with `workspace:` protocol range", () => {
        const pkg = factory({
          dependencies: {
            a: "workspace:^1.0.0",
            b: "workspace:^1.0.0",
            c: "workspace:./foo",
            d: "file:./foo",
            e: "^1.0.0",
          },
        });

        const resolved: NpaResolveResult = npa.resolve("a", "^1.0.0", ".");
        resolved.explicitWorkspace = true;

        pkg.updateLocalDependency(resolved, "2.0.0", "^");

        expect(pkg.toJSON()).toMatchInlineSnapshot(`
          Object {
            "dependencies": Object {
              "a": "workspace:^2.0.0",
              "b": "workspace:^1.0.0",
              "c": "workspace:./foo",
              "d": "file:./foo",
              "e": "^1.0.0",
            },
          }
        `);
      });

      it("works with star workspace input target `workspace:*` and will keep same output target", () => {
        const pkg = factory({
          devDependencies: {
            a: "workspace:*",
            b: "workspace:^1.0.0",
          },
        });

        const resolved: NpaResolveResult = npa.resolve("a", "^1.0.0", ".");
        resolved.explicitWorkspace = true;
        resolved.workspaceTarget = 'workspace:*';

        pkg.updateLocalDependency(resolved, "2.0.0", "^");

        expect(pkg.toJSON()).toMatchInlineSnapshot(`
          Object {
            "devDependencies": Object {
              "a": "workspace:*",
              "b": "workspace:^1.0.0",
            },
          }
        `);
      });

      it("works with caret workspace input target `workspace:^` and will keep same output target", () => {
        const pkg = factory({
          optionalDependencies: {
            a: "workspace:^",
            b: "workspace:^1.0.0",
          },
        });

        const resolved: NpaResolveResult = npa.resolve("a", "^1.0.0", ".");
        resolved.explicitWorkspace = true;
        resolved.workspaceTarget = 'workspace:^';

        pkg.updateLocalDependency(resolved, "2.0.0", "^");

        expect(pkg.toJSON()).toMatchInlineSnapshot(`
          Object {
            "optionalDependencies": Object {
              "a": "workspace:^",
              "b": "workspace:^1.0.0",
            },
          }
        `);
      });

      it("works with tilde workspace input target `workspace:~` and will keep same output target", () => {
        const pkg = factory({
          dependencies: {
            a: "workspace:~",
            b: "workspace:^1.0.0",
          },
        });

        const resolved: NpaResolveResult = npa.resolve("a", "^1.0.0", ".");
        resolved.explicitWorkspace = true;
        resolved.workspaceTarget = 'workspace:~';

        pkg.updateLocalDependency(resolved, "2.0.0", "^");

        expect(pkg.toJSON()).toMatchInlineSnapshot(`
          Object {
            "dependencies": Object {
              "a": "workspace:~",
              "b": "workspace:^1.0.0",
            },
          }
        `);
      });
    });

    describe('Publish with `workspace:` protocol', () => {
      it("should transform `workspace:*` protocol to exact range when calling a publish", () => {
        const pkg = factory({
          dependencies: {
            a: "workspace:*",
            b: "workspace:^1.0.0",
          },
        });

        const resolvedA: NpaResolveResult = npa.resolve("a", "^1.0.0", ".");
        resolvedA.explicitWorkspace = true;
        resolvedA.workspaceTarget = 'workspace:*';
        const resolvedB: NpaResolveResult = npa.resolve("b", "^1.0.0", ".");
        resolvedB.explicitWorkspace = true;
        resolvedB.workspaceTarget = 'workspace:^1.0.0';

        pkg.updateLocalDependency(resolvedA, "2.0.0", "^", true, 'publish');
        pkg.updateLocalDependency(resolvedB, "1.1.0", "^", true, 'publish');

        expect(pkg.toJSON()).toMatchInlineSnapshot(`
          Object {
            "dependencies": Object {
              "a": "2.0.0",
              "b": "^1.1.0",
            },
          }
        `);
      });

      it("should transform `workspace:^` protocol to semver range when calling a publish", () => {
        const pkg = factory({
          dependencies: {
            a: "workspace:^",
            b: "workspace:~1.0.0",
          },
        });

        const resolvedA: NpaResolveResult = npa.resolve("a", "^1.0.0", ".");
        resolvedA.explicitWorkspace = true;
        resolvedA.workspaceTarget = 'workspace:^';
        const resolvedB: NpaResolveResult = npa.resolve("b", "^1.0.0", ".");
        resolvedB.explicitWorkspace = true;
        resolvedB.workspaceTarget = 'workspace:~1.0.0';

        pkg.updateLocalDependency(resolvedA, "2.0.0", "^", true, 'publish');
        pkg.updateLocalDependency(resolvedB, "1.1.0", "~", true, 'publish');

        expect(pkg.toJSON()).toMatchInlineSnapshot(`
          Object {
            "dependencies": Object {
              "a": "^2.0.0",
              "b": "~1.1.0",
            },
          }
        `);
      });

      it("should transform `workspace:~` protocol to semver range when calling a publish", () => {
        const pkg = factory({
          dependencies: {
            a: "workspace:~",
            b: "workspace:^1.0.0",
          },
        });

        const resolvedA: NpaResolveResult = npa.resolve("a", "^1.0.0", ".");
        resolvedA.explicitWorkspace = true;
        resolvedA.workspaceTarget = 'workspace:~';
        const resolvedB: NpaResolveResult = npa.resolve("b", "^1.0.0", ".");
        resolvedB.explicitWorkspace = true;
        resolvedB.workspaceTarget = 'workspace:^1.0.0';

        pkg.updateLocalDependency(resolvedA, "2.0.0", "^", true, 'publish');
        pkg.updateLocalDependency(resolvedB, "1.1.0", "^", true, 'publish');

        expect(pkg.toJSON()).toMatchInlineSnapshot(`
          Object {
            "dependencies": Object {
              "a": "~2.0.0",
              "b": "^1.1.0",
            },
          }
        `);
      });
    });
  });
});

describe('Package.lazy()', () => {
  (loadJsonFile.sync as any).mockImplementation(() => ({ name: 'bar', version: '1.0.0' }));

  it('returns package instance from string directory argument', () => {
    const pkg = Package.lazy('/foo/bar');

    expect(pkg).toBeInstanceOf(Package);
    expect(pkg.location).toMatch(path.normalize('/foo/bar'));
  });

  it('returns package instance from package.json file argument', () => {
    const pkg = Package.lazy('/foo/bar/package.json');

    expect(pkg).toBeInstanceOf(Package);
    expect(pkg.location).toMatch(path.normalize('/foo/bar'));
  });

  it('returns package instance from json and dir arguments', () => {
    const pkg = Package.lazy({ name: 'bar', version: '1.2.3' } as RawManifest, '/foo/bar');

    expect(pkg).toBeInstanceOf(Package);
    expect(pkg.version).toBe('1.2.3');
  });

  it('returns existing package instance', () => {
    const existing = new Package({ name: 'existing' } as RawManifest, '/foo/bar', '/foo');
    const pkg = Package.lazy(existing);

    expect(pkg).toBe(existing);
  });
});
