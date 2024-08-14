import "dotenv/config";
import { DbController } from "../controllers/db.controller";
import { PaperlessController } from "../controllers/paperless.controller";
import { ISOFT_INPUT } from "@prisma/client";
import cron from "node-cron";
import Printer from "../utils/utils";
const print = new Printer("generate-contract");

const task = async () => {
    // try {
    //     const db = new DbController();

    //     const config = await db.getConfig()
    //     console.log(config)
    //     // const users = await db.getUserByLastLogin()

    // } catch (e) {
    //     print.log(`Error: ${e}`)
    // }
}

if (process.argv.includes('--manual')) {
    task()
} else {
    if (process.env.CHECK_LOGIN) {
        console.log("init check login as", process.env.CHECK_LOGIN)
        cron.schedule(process.env.CHECK_LOGIN, task)
    }
}
