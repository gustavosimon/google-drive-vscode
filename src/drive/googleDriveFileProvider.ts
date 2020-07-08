import { DriveFile } from "./driveTypes";
import { DriveTypeConverter } from "./driveTypeConverter";
import { DriveAuthenticator } from '../auth/driveAuthenticator';
import * as fs from "fs";
const { google } = require('googleapis');
import { IFileProvider } from "./driveModel";

const HTTP_RESPONSE_OK = 200;

export class GoogleDriveFileProvider implements IFileProvider {

    private authenticator = new DriveAuthenticator();

    provideFiles(parentFolderId: string): Promise<DriveFile[]> {
        return new Promise((resolve, reject) => {
            this.authenticator.authenticate().then((auth) => {
                const listParams = {
                    q: `'${parentFolderId}' in parents and trashed = false`,
                    orderBy: 'folder,name',
                    fields: 'nextPageToken, files(id, name, iconLink, mimeType)'
                };
                const callbackFn = (err: any, res: any) => {
                    if (err) {
                        return reject(err);
                    }
                    const apiFiles = res.data.files;
                    const convertedFiles = DriveTypeConverter.fromApiToTypescript(apiFiles);
                    resolve(convertedFiles);
                };
                drive(auth).files.list(listParams, callbackFn);
            }).catch(err => reject(err));
        });
    }

    uploadFile(parentFolderId: string, fullFileName: string, basename: string, mimeType: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.authenticator.authenticate().then((auth) => {
                const fileMetadata = {
                    'name': basename,
                    'parents': [parentFolderId]
                };
                const media = {
                    mimeType: mimeType,
                    body: fs.createReadStream(fullFileName)
                };
                const callbackFn = ((err: any, _file: any) => {
                    err ? reject(err) : resolve();
                });
                drive(auth).files.create({
                    resource: fileMetadata,
                    media: media,
                    fields: 'id'
                }, callbackFn);
            }).catch(err => reject(err));
        });
    }

    createFolder(parentFolderId: string, folderName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.authenticator.authenticate().then((auth) => {
                const fileMetadata = {
                    'name': folderName,
                    'mimeType': 'application/vnd.google-apps.folder',
                    'parents': [parentFolderId]
                };
                drive(auth).files.create({ resource: fileMetadata })
                    .then((response: any) => response.status == HTTP_RESPONSE_OK ? resolve() : reject())
                    .catch(() => reject());
            }).catch(err => reject(err));
        });
    }

    retrieveFileContent(fileId: string, createStreamFunction: () => NodeJS.WritableStream): Promise<void> {
        return new Promise((resolve, reject) => {
            this.authenticator.authenticate().then((auth) => {
                const getParams = {
                    'fileId': fileId,
                    'alt': 'media'
                };
                const responsType = { responseType: 'stream' };
                const callbackFn = (err: any, response: any) => {
                    if (err) return reject(err);
                    response.data
                        .on('error', (err: any) => reject(err))
                        .on('end', () => resolve())
                        .pipe(createStreamFunction());
                };
                drive(auth).files.get(getParams, responsType, callbackFn);
            }).catch(err => reject(err));;
        });
    }

}

function drive(auth: any): any {
    const drive = google.drive({ version: 'v3', auth });
    return drive;
}
