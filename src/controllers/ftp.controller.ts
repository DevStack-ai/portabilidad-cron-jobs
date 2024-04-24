import "dotenv/config"
import Printer from "../utils/utils";


import Client from "ssh2-sftp-client";
interface FTP {
    client: Client;
    settings: FTPSettings;
}

interface FTPSettings {
    host: string;
    port: number;
    username: string;
    password: string;

}

export class FtpController implements FTP {

    client: Client;
    settings: FTPSettings;
    print: any;

    constructor() {
        this.client = new Client();
        const print = new Printer("ftp");
        this.print = print;

        if (!process.env.FTP_HOST || !process.env.FTP_PORT || !process.env.FTP_USER || !process.env.FTP_PASS) {
            throw new Error("FTP settings are not set in .env file");

        }

        this.settings = {
            host: process.env.FTP_HOST,
            port: Number(process.env.FTP_PORT),
            username: process.env.FTP_USER,
            password: process.env.FTP_PASS
        }

    }

    async connect(options: FTPSettings) {
       this.print.log(`Connecting to ${options.host}:${options.port}`);
        try {
            await this.client.connect({ ...options, algorithms: { serverHostKey: ['ssh-dss'] } });
        } catch (err) {
           this.print.log('Failed to connect:', err);
        }
    }
    async listFiles(remoteDir: string) {
       this.print.log(`Listing ${remoteDir} ...`);
        let fileObjects;
        try {
            fileObjects = await this.client.list(remoteDir);
        } catch (err) {
           this.print.log('Listing failed:', err);
        }

        if (!fileObjects) return []
        const fileNames = [];

        for (const file of fileObjects) {
            if (file.type === 'd') {
                console.log(`${new Date(file.modifyTime).toISOString()} PRE ${file.name}`);
            } else {
                console.log(`${new Date(file.modifyTime).toISOString()} ${file.size} ${file.name}`);
            }

            fileNames.push(file.name);
        }

        return fileNames;
    }


    async uploadFile(localFile: string, remoteFile: string) {
       this.print.log(`Uploading ${localFile} to ${remoteFile} ...`);
        try {
            await this.client.put(localFile, remoteFile);
        } catch (err) {
           this.print.log('Uploading failed:', err);
        }
    }


    async disconnect() {
        await this.client.end();
    }



}