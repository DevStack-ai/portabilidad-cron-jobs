import "dotenv/config";
import mysql, { PoolOptions } from 'mysql2';
import prisma from "./db.connection"


type QrTableColumns = {
    esim?: string;       // por defecto: 'esim'
    status?: string;     // por defecto: 'status'
    sentDate?: string;   // por defecto: 'qr_sent_date'
    orderBy?: string;    // por defecto: 'id' (ajusta si prefieres 'created' o 'created_at')
    readyValue?: number; // por defecto: 3
};

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

    async getQrRequest(table: string, cols: QrTableColumns = {}): Promise<any> {
        const {
            esim = 'esim',
            status = 'status',
            sentDate = 'qr_sent_date',
            orderBy = 'created_at',
            readyValue = 3,
        } = cols;



        if (table === "ISOFT_INPUT") {
            const query = await prisma.iSOFT_INPUT.findMany({
                where: {
                    esim: 1,
                    STATUS: readyValue.toString(),
                    qr_sent_date: null
                },
                orderBy: {
                    ADDED_ON: 'desc'
                },
                take: 30
            })
            return query;
        }

        return new Promise(async (resolve, reject) => {
            const query = `
                SELECT  *
                FROM ${table} t
                WHERE t.${esim} = 1
                  AND t.${status} = ${readyValue}
                  AND t.${sentDate} IS NULL
                ORDER BY t.${orderBy} DESC
                    LIMIT 30
            `;

            conn?.query(query, (err: any, results: any) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(results);
            });
        });
    }

    async markEmailSent(table: string, ref_field: string, orderId: number) {
        try {

            if (table === "ISOFT_INPUT") {
                // Handle specific logic for ISOFT_INPUT
                await prisma.iSOFT_INPUT.updateMany({
                    where: {
                        IDISOFT: orderId
                    },
                    data: {
                        qr_sent_date: new Date()
                    }
                });
                return
            }

            return new Promise((resolve, reject) => {
                const query = `
                UPDATE ${table}
                SET qr_sent_date = NOW()
                WHERE ${ref_field} = ?
            `;
                if (!conn || conn === null) {
                    throw new Error("Database connection is not established");
                }
                console.log("Executing query:", query);
                conn.query(query, [orderId], (err, results) => {
                    if (err) {
                        reject(err)
                        return;
                    }
                    resolve(results)

                })
            })
        } catch (error) {
            console.error("Error marking email as sent:", error);
            return []
        }
    }

    async disconnect() {
        if (conn) {
            conn.end();
            console.log("DISCONNECTING")
        }
    }

}
