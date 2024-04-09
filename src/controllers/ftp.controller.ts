import "dotenv/config"
import ftp from 'basic-ftp';
import fs from 'fs';
import { FTPSettings } from "../../types/types";
import log from "../utils/utils";

export class FtpController {

    private client: ftp.Client;
    private settings: FTPSettings;

    constructor() {
        this.client = new ftp.Client();

        if (!process.env.FTP_HOST || !process.env.FTP_PORT || !process.env.FTP_USER || !process.env.FTP_PASSWORD) {
            throw new Error("FTP settings are not set in .env file");

        }

        this.settings = {
            host: process.env.FTP_HOST,
            port: Number(process.env.FTP_PORT),
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD
        }

    }


    async upload(sourcePath: string, remotePath: string) {
        try {
            await this.client.access(this.settings);
            const upload = await this.client.uploadFrom(fs.createReadStream(sourcePath), remotePath);

            return upload
        } catch (err) {
            log(err);
        }
        this.client.close();
    }

    close() {
        this.client.close();
    }

 

}