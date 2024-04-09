import "dotenv/config"
import * as ftp from 'basic-ftp';
import fs from 'fs';
import log from "../utils/utils";


import Client from "ssh2-sftp-client";
interface FTP {
    client: Client;
    settings: FTPSettings;
}

interface FTPSettings {
    host: string;
    port: number;
    user: string;
    password: string;

}

export class FtpController implements FTP {

    client: Client;
    settings: FTPSettings;

    constructor() {
        this.client = new Client();

        if (!process.env.FTP_HOST || !process.env.FTP_PORT || !process.env.FTP_USER || !process.env.FTP_PASS) {
            throw new Error("FTP settings are not set in .env file");

        }

        this.settings = {
            host: process.env.FTP_HOST,
            port: Number(process.env.FTP_PORT),
            user: process.env.FTP_USER,
            password: process.env.FTP_PASS
        }

    }


    async upload(sourcePath: string, remotePath: string) {
        try {
            await this.client.connect(this.settings);
            const upload = await this.client.put(fs.createReadStream(sourcePath), remotePath);
            log(`Uploaded successfully`);
            return upload
        } catch (err) {
            log(`Error uploading file: ${err}`);
        }
        this.client.end();
    }

    close() {
        this.client.end();
    }



}