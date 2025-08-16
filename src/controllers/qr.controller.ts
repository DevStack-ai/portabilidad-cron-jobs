import "dotenv/config";
import prisma from "./db.connection"
import mysql, { PoolOptions } from 'mysql2';
import { generateXMLTemplateP2P } from "../utils/generatePayload";
import sharp from "sharp";
import Printer from "../utils/utils"
import moment from "moment";
import axios from "axios";
import fs from "fs";

const access: PoolOptions = {
    user: process.env.DATABASE_USER,
    database: "PORTABILIDAD",
    password: process.env.DATABASE_PASS,
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    waitForConnections: true,
    connectionLimit: 10,
};
let conn: mysql.Pool | null = null
export class QrController {

    constructor(is_dev: boolean = false) {
        if (is_dev) {
            const config = {
                ...access,
                database: "PORTABILIDAD_DES"
            }
            console.log("Creating pool", config)
            conn = mysql.createPool(config);
        } else {
            console.log("Creating pool", access)
            conn = mysql.createPool(access);
        }
    }

    async getConfig(): Promise<{ [key: string]: any }> {
        return new Promise(async (resolve, reject) => {
            const query = `
                SELECT  *
                FROM config
            `
            conn?.query(query, (err, results: any) => {
                if (err) {
                    reject(err)
                    return;
                }
                const hash = results.reduce((acc: any, item: any) => {
                    acc[item.nombre] = item.valor;
                    return acc;
                }, {})
                resolve(hash)
            })
        })
    }

    async getQrRequest(table: string): Promise<any> {
        return new Promise(async (resolve, reject) => {

            const query = `
                SELECT  *
                FROM ${table} t
                WHERE t.esim = 1 
                AND t.status = 3
                AND t.qr_sent_date IS NULL
                ORDER BY t.created_at DESC
                LIMIT 30
            `
            console.log("Executing query:", query);
            conn?.query(query, (err, results) => {
                if (err) {
                    reject(err)
                    return;
                }
                const rows = results as []
                resolve(rows)
            })
        })
    }

    async markEmailSent(table: string, ref_field: string, orderId: number) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE ${table}
                SET qr_sent_date = NOW()
                WHERE ${ref_field} = ?
            `
            console.log("Executing query:", query);
            conn?.query(query, [orderId], (err, results) => {
                if (err) {
                    reject(err)
                    return;
                }
                resolve(results)
            })
        })
    }

    async disconnect() {
        console.log("DISCONNECTING")
        await conn?.end();
    }

}
