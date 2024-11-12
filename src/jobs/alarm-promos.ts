import "dotenv/config";
import { Pre2PostController } from "../controllers/prepost.controller";
import Printer from "../utils/utils";
import cron from "node-cron";
import xlsx from "xlsx";
import nodemailer from "nodemailer";
import ses from "nodemailer-ses-transport";
import fs from "fs";

const print = new Printer("alarm-promos");

// const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const task = async (config: any) => {
    try {
        console.log
        print.log(`Starting alarm ===================================================================`);
        const emails = config.promos_alarm_emails.split(',').map((item: string) => item.trim());
        const pre2post = new Pre2PostController();

        print.log(`Fetch from database`);
        const data = await pre2post.getPromosNextToExpire(Number(config.alarm_activation_minutes_offset));
        if (data.length === 0) {
            print.log(`No data to alarm`)
            return;
        }

        const options: any = {
            accessKeyId: config.ses_key_id,
            secretAccessKey: config.ses_access_key,
        };
        const transporter = nodemailer.createTransport(ses(options));

        //write to excel and attach
        const columns = data.length ? Object.keys(data[0]) : []
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        //Fecha de envio a liberate as DD/MM/YYYY HH:mm
      

        const wscols = columns.map((item) => ({ wch: Math.max(20, item.length) }))
        ws["!cols"] = wscols

        xlsx.utils.book_append_sheet(wb, ws, "Alarma");
        const filename = `ALARM_PROMOS_${new Date().toISOString().replace(/:/g, "-")}.xlsx`;
        xlsx.writeFile(wb, `${process.env.TMP_DIR}/${filename}`);

        const mailOptions = {
            from: config.alarm_email_from,
            to: emails,
            subject: 'Promociones a vencer',
            text: ``,
            attachments: [{
                filename: filename,
                path: `${process.env.TMP_DIR}/${filename}`,
                content: fs.createReadStream(`${process.env.TMP_DIR}/${filename}`)

            }]
        };

        transporter.sendMail(mailOptions, async (error, info) => {
            if (error) {
                print.log(`Error sending email: ${error}`);
            } else {
                print.log(`Email sent: ${JSON.stringify(info)}`);
                fs.unlinkSync(`${process.env.TMP_DIR}/${filename}`);
            }
        });

        print.log(`Endalarm ===================================================================`)
    } catch (e) {
        console.log(e)
        print.log(`Error: ${e}`)
    }

}




(async () => {
    const pre2post = new Pre2PostController();

    const config = await pre2post.getConfirV2();
    if (!config) {
        console.error("No config found")
        return;
    }
    if (process.argv.includes('--manual')) {
        task(config)
    } else {
        if (config.promos_alarm_cron) {
            console.log("init report as", config.promos_alarm_cron)
            cron.schedule(config.promos_alarm_cron, () => task(config))
        } else {
            console.log("No cron set <ALARM_PRE2POST>")
        }
    }
})();