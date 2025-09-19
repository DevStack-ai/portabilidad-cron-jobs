import "dotenv/config";
import prisma from "./db.connection"
import mysql, { PoolOptions } from 'mysql2';
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
// hold_transactions {
//   id                Int       @id @default(autoincrement())
//   port_type         Int
//   user_id           Int
//   status            Int?      @default(1)
//   files             String    @db.LongText
//   payload           String    @db.LongText
//   transaction_id    String?   @db.VarChar(255)
//   created_at        DateTime? @default(now()) @db.DateTime(0)
//   updated_at        DateTime? @default(now()) @db.DateTime(0)
//   document          String?   @db.VarChar(255)
//   document_type     Int?
//   phone             String?   @db.VarChar(255)
//   contract_number   String?   @db.VarChar(255)
//   porta_transaction String?   @db.LongText
//   porta_response    String?   @db.LongText
// }

interface HoldTransaction {
    id: number;
    port_type: number;
    user_id: number;
    status: number;
    files: string;
    payload: string;
    transaction_id: string | null;
    created_at: Date;
    updated_at: Date;
    document: string | null;
    document_type: number | null;
    phone: string | null;
    contract_number: string | null;
    porta_transaction: string | null;
    porta_response: string | null;
}


let conn: mysql.Pool | null = null
export class HoldController {

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

    async disconnect() {
        try {
            conn?.end()
            console.log("Closing pool")
        } catch (e) {
            console.log("Error closing pool", e)
        }

    }

    async getConfig(key?: string) {
        return new Promise<any>((resolve, reject) => {
            conn?.query(`
                SELECT * FROM config
                ${key ? `WHERE \`key\` = ?` : ''}
            `, [key], (error, results) => {
                if (error) {
                    reject(error);
                    return
                }
                const rows = results as any[]
                const hashConfig: any = {}
                for (const row of rows) {
                    hashConfig[row.nombre] = row.valor
                }
                resolve(hashConfig);
            });
        });
    }

    async getHoldTransactions() {

        const LIMIT = process.env.HOLD_LIMIT ? Number(process.env.HOLD_LIMIT) : 10
        return new Promise<HoldTransaction[]>((resolve, reject) => {
            conn?.query(`
                SELECT * FROM hold_transactions 
                WHERE status = 1
                ORDER BY created_at ASC
                LIMIT ${LIMIT}
            `, (error, results) => {
                if (error) {
                    reject(error);
                    return
                }
                const rows = results as HoldTransaction[]
                resolve(rows);

            });
        });
    }

    async updateStatus(id: number, status: number) {
        return new Promise<void>((resolve, reject) => {
            conn?.query(`
                UPDATE hold_transactions 
                SET status = ?, updated_at = NOW()
                WHERE id = ?
            `, [status, id], (error) => {
                if (error) {
                    reject(error);
                    return
                }
                resolve();
            });
        });
    }
}
