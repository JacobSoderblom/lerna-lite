import { Package } from '@lerna-lite/core';
import { Lockfile as PnpmLockfile } from '@pnpm/lockfile-types';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import loadJsonFile from 'load-json-file';
import writeJsonFile from 'write-json-file';

import { LockfileInformation, NpmLockfile, NpmLockfileInformation, PnpmLockfileInformation } from '../types';

export const isPnpmLockfile = (x: LockfileInformation): x is PnpmLockfileInformation =>
  x.packageManager === 'pnpm';
export const isNpmLockfile = (x: LockfileInformation): x is NpmLockfileInformation =>
  x.packageManager === 'npm';

/**
 * From a folder path provided, try to load a `pnpm-lock.yaml` file if it exists.
 * @param {String} lockFileFolderPath
 * @returns Promise<{path: string; json: Object; lockFileVersion: number; }>
 */
async function loadYamlFile<T>(filePath: string) {
  try {
    const file = await fs.promises.readFile(filePath);
    return (await yaml.load(`${file}`)) as T;
  } catch (e) {
    return undefined;
  }
}

async function writeYamlFile(filePath: string, data: unknown) {
  try {
    const str = yaml.dump(data);
    await fs.promises.writeFile(filePath, str);
  } catch (e) {} // eslint-disable-line
}

/**
 * From a folder path provided, try to load a `package-lock.json` file if it exists.
 * @param {String} lockFileFolderPath
 * @returns Promise<{path: string; json: Object; lockFileVersion: number; }>
 */
async function loadNpmLockfile(cwd: string): Promise<LockfileInformation | undefined> {
  try {
    const lockfilePath = path.join(cwd, 'package-lock.json');
    const json = await loadJsonFile<NpmLockfile>(lockfilePath);
    const version = +(json?.['lockfileVersion'] ?? 1);

    return {
      json,
      version,
      path: lockfilePath,
      packageManager: 'npm',
    };
  } catch (error) {} // eslint-disable-line
}

async function loadPnpmLockfile(cwd: string): Promise<LockfileInformation | undefined> {
  try {
    const lockfilePath = path.join(cwd, 'pnpm-lock.yaml');
    const json = (await loadYamlFile(lockfilePath)) as PnpmLockfile;
    const version = +(json?.['lockfileVersion'] ?? 1);

    return {
      json,
      version,
      path: lockfilePath,
      packageManager: 'pnpm',
    };
  } catch (error) {} // eslint-disable-line
}

export async function loadLockfile(
  cwd: string,
  npmClient?: 'npm' | 'pnpm' | 'yarn'
): Promise<LockfileInformation | undefined> {
  let lockFile;

  // when client is defined as 'npm' or simply undefined, try loading npm lock file
  if (!npmClient || npmClient === 'npm') {
    lockFile = await loadNpmLockfile(cwd);
  }

  // when client is defined as 'pnpm' or if loading npm lock file did not return anything,
  // we'll try loading pnpm lock file
  if (npmClient === 'pnpm' || !lockFile) {
    lockFile = await loadPnpmLockfile(cwd);
  }

  return lockFile;
}

/**
 * Update NPM Lock File (when found), the lock file might be version 1 (exist in package folder) or version 2 (exist in workspace root)
 * Depending on the version type, the structure of the lock file will be different and will be updated accordingly
 * @param {Object} pkg
 * @returns Promise<string>
 */
export async function updateClassicLockfileVersion(pkg: Package): Promise<string | undefined> {
  try {
    // "lockfileVersion" = 1, package lock file might be located in the package folder
    const lockFilePath = path.join(pkg.location, 'package-lock.json');
    const pkgLockFileObj: any = await loadJsonFile(lockFilePath);

    if (pkgLockFileObj) {
      pkgLockFileObj.version = pkg.version;

      // update version for a npm lockfile v2 format
      if (pkgLockFileObj.packages?.['']) {
        pkgLockFileObj.packages[''].version = pkg.version;
      }

      await writeJsonFile(lockFilePath, pkgLockFileObj, {
        detectIndent: true,
        indent: 2,
      });
      return lockFilePath;
    }
  } catch (error) {} // eslint-disable-line
}

export function updateTempModernLockfileVersion(pkg: Package, lockfile: LockfileInformation) {
  switch (lockfile.packageManager) {
    case 'pnpm':
      updatePnpmLockFile(lockfile, pkg.name, pkg.version);
      break;
    case 'npm':
      updateNpmLockFileVersion2(lockfile, pkg.name, pkg.version);
      break;
  }
}

export async function saveLockfile(lockfile: LockfileInformation) {
  try {
    switch (lockfile.packageManager) {
      case 'pnpm':
        await writeYamlFile(lockfile.path, lockfile.json);
        break;
      case 'npm':
        await writeJsonFile(lockfile.path, lockfile.json, {
          detectIndent: true,
          indent: 2,
        });
        break;
    }

    return lockfile.path;
  } catch (error) {} // eslint-disable-line
}

/**
 * Update NPM Lock File (when found), the lock file must be version 2 or higher and is considered as modern lockfile,
 * its structure is different and all version properties will be updated accordingly.
 * The json object will be updated through pointers,
 * so it won't return anything but its input argument itself will be directly updated.
 */
export function updateNpmLockFileVersion2(
  lockfile: LockfileInformation,
  pkgName: string,
  newVersion: string
) {
  if (lockfile.json && pkgName && newVersion && isNpmLockfile(lockfile)) {
    const updateNpmLockPart = (part: unknown) => {
      if (typeof part !== 'object') {
        return;
      }

      for (const k in part) {
        if (typeof part[k] === 'object' && part[k] !== null) {
          updateNpmLockPart(part[k]);
        } else {
          if (k === pkgName) {
            // ie: "@lerna-lite/core": "^0.1.2",
            const [_, versionPrefix, _versionStr] = part[k].match(/^([\^~])?(.*)$/);
            part[k] = `${versionPrefix}${newVersion}`;
          } else if (k === 'name' && part[k] === pkgName && part['version'] !== undefined) {
            // ie: "packages/version": { "name": "@lerna-lite/version", "version": "0.1.2" }
            if (part['version'] !== undefined) {
              part['version'] = newVersion;
            }
          }
        }
      }
    };
    updateNpmLockPart(lockfile.json);
  }
}

export function updatePnpmLockFile(lockfile: LockfileInformation, pkgName: string, newVersion: string) {
  if (lockfile.json && pkgName && newVersion && isPnpmLockfile(lockfile)) {
    const updatePnpmLockPart = (part: unknown) => {
      if (typeof part !== 'object') {
        return;
      }

      for (const k in part) {
        if (k === 'specifiers' && !!part[k][pkgName]) {
          const [_, versionPrefix, previousVersion] = part[k][pkgName].match(/^workspace:([\^~*])?(.*)$/);

          // update workspace version only when found to have a previous version
          // ie case 1: "@lerna-lite/core": "workspace:^1.3.2" bump minor to "workspace:^1.4.2"
          // ie case 2: "@lerna-lite/core": "workspace:^" bump minor to "workspace:^" (no old version found means no changes)
          if (versionPrefix !== '*' && previousVersion) {
            part[k][pkgName] = `workspace:${versionPrefix || ''}${newVersion}`;
          }
        } else if (
          typeof part[k] === 'object' &&
          part[k] !== null &&
          part[k] !== undefined &&
          k !== 'specifiers' &&
          k !== 'dependencies'
        ) {
          updatePnpmLockPart(part[k]);
        }
      }
    };

    updatePnpmLockPart(lockfile.json.importers);
  }
}
