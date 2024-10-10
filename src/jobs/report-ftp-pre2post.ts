import "dotenv/config";
import { FtpController } from "../controllers/ftp.controller";
import { Pre2PostController } from "../controllers/prepost.controller";

import { json2csv } from "../utils/json2csv";
import fs from "fs";
import moment from "moment";
import Printer from "../utils/utils";
import cron from "node-cron";

const print = new Printer("report-ftp");

// const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const task = async () => {
    try {
        print.log(`Starting report ftp ===================================================================`);
        const ftp = new FtpController();
        const db = new Pre2PostController();

        const host = process.env.FTP_HOST;
        const port = Number(process.env.FTP_PORT);
        const username = process.env.FTP_USER;
        const password = process.env.FTP_PASS;

        if (!host || !port || !username || !password) {
            throw new Error("FTP settings are not set in .env file");
        }

        print.log(`Connecting to FTP`);
        await ftp.connect({ host, port, username, password });
        print.log(`Connected to FTP`);


        print.log(`Fetch from database`);
        const data = await db.getReport();
        // const activations = await db.getReportActivations();
        print.log(`Fetched v1: ${data.length} records`);
        console.log(data)

        const ids = data.map((item: any) => item.CONTRACTID)
        // const idsActivations = activations.map((item: any) => item.CONTRACTID)

        print.log(`Converted to CSV`);
        const csv = json2csv(data);
        // const csvActivations = json2csv(activations);

        print.log(`Converted to CSV Activations`);
        const today = moment().add(-5, "hour").format("YYYYMMDDHHmmss")
        const filename = `DEV_INTPORT_${today}.txt`;
        // const filenameActivations = `POSTACT_${today}.txt`;

        const dir = `${process.env.TMP_DIR}/${filename}`
        // const dirActivations = `${process.env.TMP_DIR}/${filenameActivations}`

        print.log(`Writing to file: ${dir}`);
        fs.writeFileSync(dir, csv, { encoding: 'utf-8' });
        print.log(`File written successfully`);

        // print.log(`Writing to file Activations: ${dirActivations}`);
        // fs.writeFileSync(dirActivations, csvActivations, { encoding: 'utf-8' });
        // print.log(`File written successfully`);

        const toPath = `${process.env.FTP_DIR}/${filename}`;
        if (csv) {
            print.log(`Uploading to FTP: ${toPath}`)
            await ftp.uploadFile(dir, toPath);
            print.log(`Uploaded successfully ===================================================================`);
        } else {
            print.log(`No data to upload to FTP ================================================================`);
        }


        if (data.length !== 0) {
            print.log('Updating database');
            await db.updateReport(ids, filename);
            print.log(`Database updated`);
        }

        if (data.length === 0) {
            fs.unlinkSync(dir)
        }

        db.disconnect();
        print.log(`End of report ftp ===================================================================`)
    } catch (e) {
        console.log(e)
        print.log(`Error: ${e}`)
    }

}

if (process.argv.includes('--manual')) {
    task()
} else {
    if (process.env.CRON_REPORT_PRE2POST) {
        console.log("init report as", process.env.CRON_REPORT_PRE2POST)
        cron.schedule(process.env.CRON_REPORT_PRE2POST, () => task())
    }
}
