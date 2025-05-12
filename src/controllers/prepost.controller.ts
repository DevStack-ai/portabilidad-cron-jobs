import "dotenv/config";
import prisma from "./db.connection"
import { ISOFT_INPUT } from "@prisma/client";
import mysql, { PoolOptions } from 'mysql2';
import { generateXMLTemplate, generateXMLTemplateP2P } from "../utils/generatePayload";
import sharp from "sharp";
import Printer from "../utils/utils"
import moment from "moment";
import axios from "axios";
import fs from "fs";
const print = new Printer("p2p-paperless-controller");

const access: PoolOptions = {
    user: process.env.DATABASE_USER,
    database: "PORTABILIDAD",
    password: process.env.DATABASE_PASS,
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    waitForConnections: true,
    connectionLimit: 10,
};
export interface Pre2Post {
    TRANSACTION_ID: number;
    MSISDN: string;
    ICCID_N: string;
    ICCID_N_COMP: string;
    KI_N: string;
    IMSI_N: string;
    SCP_ID: string;
    STATUS: number;
    ADDED_ON: Date;
    PIN: string;
    SMS_SENT_ON: Date;
    PIN_CHECK_RES: string;
    PIN_CHECK_RES_ON: Date;
    CONTRACTID: number;
    LIB_FILE: string;
    LIB_FILE_SENT_ON: Date;
    LIB_ACCT_NO: number;
    LIB_ID: string;
    DN_ACTIVE_ON: Date;
    REMARKS: string;
    ICCID_O_COMP: string;
    IMSI_O: string;
    BILLGROUP: string;
    ETC1: string;
    ETC2: string;
    USERID: string;
    AREA: string;
    REINTENTO: number;
    FECHAUPDATE: Date;
    PASO: number;
    FECHA_ENVIAR_CONTRACT: Date;
    ERROR_ENVIAR_CONTRACT: string;
    phone: string;
    sgo_ported_phone: string;
    user_id: number;
    origin: number;
    nip: string;
    document_type: number;
    c_provincia: number;
    c_folio: number;
    c_asiento: number;
    c_letra: string;
    passport: string;
    ruc: string;
    name: string;
    contact_phone: string;
    email: string;
    provincia: number;
    distrito: number;
    corregimiento: number;
    barrio: number;
    address: string;
    home_type: number;
    home_number: string;
    doc_front_path: string;
    doc_back_path: string;
    s3_spn_path: string;
    signature: string;
    rpa_status: number;
    rpa_retries: number;
    rpa_actor: string;
    rpa_message: string;
    nip_req_id: number;
    created_at: Date
    updated_at: Date
    created_by: number;
    updated_by: number;
    sgo_account: string
    simcard: string;
    contrato: string;
    sgo_number: string;
    rpa_sgo_user: string;
    updated_at_sgoadmin: Date;
    b_address: string;
    b_corregimiento: number;
    s3_front_document: string;
    s3_auth_pdf_path: string;
    CEDULA: string;
    NOMBRE_VENDEDOR: string;
    CEDULA_VENDEDOR: string;
    FIRMA_VENDEDOR: string;
    DONOR_OP: string;
    s3_contract_path: string;
    s3_apc_path?: string;
    apc_signature?: string;
}

let conn: mysql.Pool | null = null
export class Pre2PostController {


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

    async getConfirV2(): Promise<any> {
        const query = `SELECT * FROM config;`
        return new Promise((resolve, reject) => {
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
    async getReport(): Promise<[]> {
        return new Promise(async (resolve, reject) => {
            const query = `
            SELECT 
                p2p.msisdn,
                'Y',
                p2p.ICCID_N,
                TRIM(SUBSTRING_INDEX(p2p.name, '{|}', 1)) as name,
                TRIM(SUBSTRING_INDEX(p2p.name, '{|}', -1)) as lastname,
                CASE
                    WHEN p2p.document_type = 1 THEN 'C'
                    WHEN p2p.document_type = 2 THEN 'PP'
                    ELSE 'C'
                END as doc_type,
                CASE
                    WHEN p2p.document_type = 1 THEN concat(p2p.c_provincia,'-',p2p.c_folio,'-',p2p.c_asiento)
                    WHEN p2p.document_type = 2 THEN p2p.passport
                    ELSE 'C'
                END as document,
                email as email,
                l1.nombre as l1, 
                l2.nombre as l2,
                l3.nombre as l3, 
                SUBSTRING(REPLACE(p2p.address,',', ''), 1, 40) as address,
                SUBSTRING(REPLACE(p2p.address,',', ''), 41, LENGTH(p2p.address)) as address2,
                pp.code as plan,
                discount_code,
                BILLGROUP,
                CONTRACTID
            FROM
                PRE2POST_ISOFT_INPUT_INTPORT p2p
                join location l1 on l1.id = provincia
                join location l2 on l2.id = distrito
                join location l3 on l3.id = corregimiento
                join postpaid_plan pp on pp.id = post_paid_plan_id
            WHERE 
                p2p.CONTRACTID is not null
            AND p2p.STATUS in (1,2)
            AND LIB_FILE_SENT_ON is null;`

            conn?.query(query, (err,
                results) => {
                if (err) {
                    reject(err)
                    return;
                }
                const rows = results as []
                resolve(rows)
            })
        })
    }

    async getReportActivations(): Promise<[]> {
        return new Promise(async (resolve, reject) => {
            const query = `
                      SELECT 
                        "ACT",
                        act.TRANSACTION_ID,
                        act.msisdn,
                        act.ICCID,
                        TRIM(SUBSTRING_INDEX(REPLACE(act.name, ',', ''), '{|}', 1)) as name,
                        TRIM(SUBSTRING_INDEX(REPLACE(act.name, ',', ''), '{|}', - 1)) as lastname,
                        CASE
                            WHEN act.document_type = 1 THEN 'C'
                            WHEN act.document_type = 2 THEN 'PP'
                            ELSE 'C'
                        END as doc_type,
                        CASE
                            WHEN act.document_type = 1 THEN TRIM(concat(act.c_provincia,'-',act.c_folio,'-',act.c_asiento))
                            WHEN act.document_type = 2 THEN TRIM(act.passport)
                            ELSE 'C'
                        END as document,
                        REPLACE(act.email, ',', '') as email,
                        l1.nombre as l1, 
                        l2.nombre as l2,
                        l3.nombre as l3, 
                        SUBSTRING(REPLACE(act.address, ',', ''), 1, 40) as address,
                        SUBSTRING(REPLACE(act.address, ',', ''), 41, LENGTH(act.address)) as address2,
                        act.PACKAGE_ID,
                        TRIM(discount_code),
                        "" as nip,
                        BILLGROUP,
                        CONTRACTID,
                        IFNULL(lsa.area_code, "") as area,
                        pt.liberate_value,
                        act.source,
                        act.simcard,
                        act.mrc,
                        act.mrc_n,
                        act.mrc_amount 
                    FROM
                        AP_ISOFT_INPUT_POSTPAID act
                        join location l1 on l1.id = provincia
                        join location l2 on l2.id = distrito
                        join location l3 on l3.id = corregimiento
                        join postpaid_plan pp on pp.id = post_paid_plan_id
                        join user u on u.id = act.user_id 
                        join area a on a.id = u.area_id 
                        left join liberate_source_app lsa on lsa.id = a.liberate_source_app_id
                        join plan_types pt on pt.id  = pp.plan_type
                    WHERE 
                        act.CONTRACTID is not null
                    AND act.STEP = 5
                    AND act.file_content is null
                    AND act.STATUS in (1,2)
                    AND LIB_FILE_SENT_ON is null;`

            conn?.query(query, (err,
                results) => {
                if (err) {
                    reject(err)
                    return;
                }
                const rows = results as []
                resolve(rows)
            })
        })
    }

    async getReportPortasPre2Post(): Promise<[]> {
        return new Promise(async (resolve, reject) => {
            const query = `
            SELECT 
                p2p.TRANSACTION_ID,
                p2p.msisdn,
                'Y',
                 CASE
                    WHEN p2p.simcard IS NULL OR TRIM(p2p.simcard) = "" THEN p2p.ICCID_N 
                    ELSE p2p.simcard
                END as ICCID_N,
                TRIM(SUBSTRING_INDEX(p2p.name, '{|}', 1)) as name,
                TRIM(SUBSTRING_INDEX(p2p.name, '{|}', -1)) as lastname,
                CASE
                    WHEN p2p.document_type = 1 THEN 'C'
                    WHEN p2p.document_type = 2 THEN 'PP'
                    ELSE 'C'
                END as doc_type,
                CASE
                    WHEN p2p.document_type = 1 THEN TRIM(concat(p2p.c_provincia,'-',p2p.c_folio,'-',p2p.c_asiento))
                    WHEN p2p.document_type = 2 THEN TRIM(p2p.passport)
                    ELSE 'C'
                END as document,
                REPLACE(p2p.email, ',', '') as email,
                l1.nombre as l1, 
                l2.nombre as l2,
                l3.nombre as l3, 
                SUBSTRING(REPLACE(p2p.address ,',', ''), 1, 40) as address,
                SUBSTRING(REPLACE(p2p.address ,',', ''), 41, LENGTH(p2p.address)) as address2,
                pp.code as plan,
                TRIM(discount_code),
                BILLGROUP,
                CONTRACTID,
                IFNULL(lsa.area_code, "") as area,
                pt.liberate_value,
                p2p.source,
                p2p.simcard,
                p2p.mrc,
                p2p.mrc_n,
                p2p.mrc_amount 
            FROM
                PRE2POST_ISOFT_INPUT_INTPORT p2p
                join location l1 on l1.id = provincia
                join location l2 on l2.id = distrito
                join location l3 on l3.id = corregimiento
                join postpaid_plan pp on pp.id = post_paid_plan_id
                join user u on u.id = p2p.user_id 
                join area a on a.id = u.area_id 
                left join liberate_source_app lsa on lsa.id = a.liberate_source_app_id 
                join plan_types pt on pt.id = pp.plan_type 
            WHERE 
                p2p.CONTRACTID is not null
            AND p2p.STATUS in (1,2)
            AND p2p.STEP = 5
            AND LIB_FILE_SENT_ON is null;`

            conn?.query(query, (err,
                results) => {
                if (err) {
                    reject(err)
                    return;
                }
                const rows = results as []
                resolve(rows)
            })
        })
    }

    async updateReport(ids: number[], filename: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            console.log("updateReport", ids, filename)
            const query = `UPDATE PRE2POST_ISOFT_INPUT_INTPORT SET LIB_FILE_SENT_ON = NOW(), LIB_FILE = "${filename}" WHERE CONTRACTID IN (${ids.join(",")});`
            conn?.query(query, (err, results) => {
                if (err) {
                    reject(err)
                    return;
                }
                resolve()
            })
        })

    }

    async updateReportActivations(ids: number[], filename: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            const query = `UPDATE AP_ISOFT_INPUT_POSTPAID SET LIB_FILE_SENT = NOW(), LIB_FILE_SENT_ON = NOW(), LIB_FILE = "${filename}", REMARKS = "PROCESSING" WHERE CONTRACTID IN (${ids.join(",")});`
            conn?.query(query, (err, results) => {
                if (err) {
                    reject(err)
                    return;
                }
                resolve()
            })
        })

    }

    async updateField(id: number, field: string, value: string | number): Promise<void> {


        return new Promise((resolve, reject) => {
            try {
                const query = typeof value === "string" ? `UPDATE PRE2POST_ISOFT_INPUT_INTPORT SET ${field} = "${value}" WHERE TRANSACTION_ID = ${id};` : `UPDATE PRE2POST_ISOFT_INPUT_INTPORT SET ${field} = ${value} WHERE TRANSACTION_ID = ${id};`
                conn?.query(query, (err, results) => {
                    if (err) {
                    }
                    resolve()
                })
            } catch (e) {
                resolve()
            }
        })

    }


    async getDataWithoutContract(estado_oracle: number = 0): Promise<Pre2Post[]> {


        return new Promise((resolve, reject) => {

            const query = `
                SELECT
                    l.nombre as distrito_name,
                    l2.nombre as provincia_name,
                    pp.name as plan_name,
                    pp.month_charge as plan_month_charge,
                    pp.credit_limit as plan_credit_limit,
                    pp.min_inlcuded as plan_min_included,
                    pp.min_all_net as plan_min_all_net,
                    pp.min_on_net as plan_min_on_net,
                    pp.min_cost_excedent  as plan_min_cost_excedent,
                    pp.min_cost_mobile as plan_min_cost_mobile,
                    pp.sms as plan_sms,
                    pp.gprs as plan_gprs,
                    pp.cost_excedent as plan_cost_excedent,
                    pp.description as plan_description,
                    pp.mrc as plan_mrc,
                    pp.mb_included as plan_mb_included,
                    pp.kb_excedent as plan_kb_excedent,
                    u.name as seller_name,
                    u.document as seller_document,
                    ppii.name as client_name,
                    ppii.*
                FROM
                          PRE2POST_ISOFT_INPUT_INTPORT ppii
                LEFT JOIN location l ON l.id = ppii.distrito 
                LEFT JOIN location l2 ON l2.id  = ppii.provincia
                LEFT JOIN postpaid_plan pp ON pp.id = ppii.post_paid_plan_id 
                LEFT JOIN user u ON u.id = ppii.user_id 
                WHERE
                        ppii.CONTRATO_GENERADO = 0
                    AND ppii.CONTRACTID IS NULL
                    AND ppii.ENVIADO_ORACLE = ${estado_oracle}
                    AND ppii.ERROR = 0
                    AND ppii.ENVIADO_ORACLE_FECHA IS NULL
                    AND ppii.CONTRACT_ATTEMPTS < 3
                    AND ppii.STEP = 0
                    AND ppii.user_id != 0
                    AND ppii.STATUS = 2
                LIMIT ${Number(process.env.CONTRACT_BATCH_SIZE)};
            `
            // CONTRATO_GENERADO = 0
            // AND CONTRACTID IS NULL
            // AND ENVIADO_ORACLE = ${estado_oracle}
            // AND ERROR = 0
            // AND ENVIADO_ORACLE_FECHA IS NULL
            // AND CONTRACT_ATTEMPTS < 3
            // AND STEP = 0
            // AND user_id != 0

            conn?.query(query, (err, results) => {
                if (err) {
                    reject(err)
                    return;
                }


                const rows = results as []

                const mapped = rows.map((item: Pre2Post) => {
                    let cedula = ""
                    if (item.document_type === 1) {
                        cedula = `${item.c_provincia || item.c_letra}-${item.c_folio}-${item.c_asiento}`
                    } else if (item.document_type === 2) {
                        cedula = `${item.passport}`
                    } else {
                        cedula = `${item.ruc}`
                    }

                    return {
                        ...item,
                        CEDULA: cedula
                    }
                })
                resolve(mapped)
            })
        })

    }

    generateContract(contract: any, type: string): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {

                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();
                const str = generateXMLTemplateP2P(contract, type);
                console.log(str)
                const filename = `PRE2POST${contract.request_number}.xml`
                const dir = `${process.env.TMP_DIR}/${filename}`

                fs.writeFileSync(dir, str);
                const file = fs.readFileSync(dir);
                const xml = new Blob([file], { type: 'application/xml' });

                form.append("source_file", xml, filename);
                form.append('source_url', process.env.CONTRACT_API_URL);
                form.append('websign', "true");
                form.append('privileged', "true");
                form.append('source_action', "Try it out");
                form.append("source_app", "IsoftApp");

                // const auth = authHMAC(str);
                const request_time = new Date().toJSON().slice(0, 19)
                const params = `request_time=${request_time}-06:00`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts?${params}`;

                const query = await axios.post(url, form, { headers: headers });

                const row = query.data.contracts[0]
                resolve(row.id);
                fs.unlinkSync(dir);

            } catch (e) {
                reject(e);
            }
        });
    }

    async getDataByStep(step: number, estado_oracle: number = 0): Promise<Pre2Post[]> {


        // const query = await prisma.iSOFT_INPUT.findMany({
        //     where: {
        //         CONTRATO_GENERADO: 1,
        //         ENVIADO_ORACLE: estado_oracle,
        //         STEP: step,
        //         ERROR: 0,
        //         ENVIADO_ORACLE_FECHA: null,
        //         CONTRACT_ATTEMPTS: {
        //             lt: 3
        //         }
        //     },
        //     // orderBy: {
        //     //     IDISOFT: "desc"
        //     // },
        //     take: Number(process.env.CONTRACT_BATCH_SIZE)

        // })


        // return query

        return new Promise((resolve, reject) => {

            const query = `
                    SELECT
                         *,
                        o.name as DONOR_OP,
                        u.name as NOMBRE_VENDEDOR,
                        u.document as CEDULA_VENDEDOR,
                        u.signature as FIRMA_VENDEDOR
                    FROM
                       PRE2POST_ISOFT_INPUT_INTPORT p2p
                    LEFT JOIN PORTABILIDAD.user u ON u.id = p2p.user_id 
                    LEFT JOIN PORTABILIDAD.origin o ON o.id = p2p.origin 
                    WHERE
                        p2p.CONTRATO_GENERADO = 1
                    AND p2p.ENVIADO_ORACLE = ${estado_oracle}
                    AND p2p.STEP = ${step}
                    AND p2p.ERROR = 0
                    AND p2p.ENVIADO_ORACLE_FECHA IS NULL
                    AND p2p.CONTRACT_ATTEMPTS < 3
                    LIMIT ${Number(process.env.CONTRACT_BATCH_SIZE)};
                `

            conn?.query(query, (err, results) => {
                if (err) {
                    reject(err)
                    return;
                }
                const rows = results as []
                const mapped = rows.map((item: Pre2Post) => {
                    let cedula = ""
                    if (item.document_type === 1) {
                        cedula = `${item.c_provincia || item.c_letra}-${item.c_folio}-${item.c_asiento}`
                    } else if (item.document_type === 2) {
                        cedula = `${item.passport}`
                    } else {
                        cedula = `${item.ruc}`
                    }

                    return {
                        ...item,
                        CEDULA: cedula
                    }
                })
                resolve(mapped)
            })
        })
    }



    async failedProcess(ids: number[]): Promise<void> {


        // await prisma.iSOFT_INPUT.updateMany({
        //     where: {
        //         IDISOFT: {
        //             in: ids
        //         }
        //     },
        //     data: {
        //         CONTRACT_ATTEMPTS: {
        //             increment: 1
        //         },
        //         // STEP: step
        //     }
        // });


        return new Promise((resolve, reject) => {

            if (ids.length === 0) {
                resolve()
                return;
            }
            const query = `UPDATE PRE2POST_ISOFT_INPUT_INTPORT SET CONTRACT_ATTEMPTS = CONTRACT_ATTEMPTS + 1 WHERE TRANSACTION_ID IN (${ids.join(",")});`
            conn?.query(query, (err, results) => {
                if (err) {
                    reject(err)
                    return;
                }
                resolve()
            })
        })



    }
    async successStep(ids: number[], step: number): Promise<void> {


        // await prisma.iSOFT_INPUT.updateMany({
        //     where: {
        //         IDISOFT: {
        //             in: ids
        //         }
        //     },
        //     data: {
        //         STEP: step
        //     }
        // });


        return new Promise((resolve, reject) => {

            if (ids.length === 0) {
                resolve()
                return;
            }
            const query = `UPDATE PRE2POST_ISOFT_INPUT_INTPORT SET STEP = ${step} WHERE TRANSACTION_ID IN (${ids.join(",")});`
            conn?.query(query, (err, results) => {
                if (err) {
                    reject(err)
                    return;
                }
                resolve()
            })
        })
    }


    async getSPN(input: Pre2Post): Promise<string> {
        try {

            const payload = {
                "IDISOFT": input.TRANSACTION_ID,
                "MSISDN": input.phone,
                "DONOR_OP": input.DONOR_OP,
                "NOMBRE_DE_CLIENTE": input.name.split("{|}").join(" "),
                "CEDULA": input.CEDULA,
                "DIRECCION_CLIENTE": input.address,
                "EMAIL_DEL_CLIENTE": input.email,
                "NOMBRE_VENDEDOR": input.NOMBRE_VENDEDOR,
                "CEDULA_VENDEDOR": input.CEDULA_VENDEDOR,
                "FIRMA_VENDEDOR": input.FIRMA_VENDEDOR,
                "FIRMA_CLIENTE": input.signature,
                "NIP": input.nip
            }
            const query = await axios.post(`${process.env.BASE_API_URL}/porta-request/spn`, payload);

            if (query.status === 200) {
                return query.data.url;
            } else {
                return "ERROR";
            }
        } catch (e) {
            print.log(e);
            return "ERROR";
        }

    }


    async closeConnection(): Promise<void> {

        await prisma.$disconnect()

    }

    async getConfig(): Promise<any> {
        const query = await prisma.$queryRaw`
        SELECT 
            *
        FROM
            config;
        `

        return query
    }

    async getUserByLastLogin(date: Date): Promise<[]> {
        const users: [] = await prisma.$queryRaw`
        SELECT 
            u.id,
            u.username,
            u.email,
            u.last_login,
            u.created_at,
            u.updated_at
        FROM
            user u
        WHERE
            u.last_login < ${date}
        ORDER BY
            u.last_login DESC;
        `
        return users
    }

    uploadSPN(id: number, contractId: number, filePath: string) {
        return new Promise(async (resolve, reject) => {
            try {

                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();

                const filename = `spnfirmado${id}.pdf`
                const fetchFile = await axios.get(filePath, { responseType: 'arraybuffer' });
                const file = fetchFile.data
                const cedula = new Blob([file], { type: 'application/pdf' });

                form.append("file", cedula, filename);
                form.append('name', "spnfirmado");
                form.append('type', "spn_attachment");

                const request_time = new Date().toJSON().slice(0, 19)
                const params = `request_time=${request_time}-06:00`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts/${contractId}/attachments?${params}`;

                const query = await axios.post(url, form, { headers: headers });
                resolve(query);
                fs.unlinkSync(filename);
            } catch (e) {
                reject(e);
            }
        });
    }


    uploadId(contractId: number, filePath: string, type: string) {
        return new Promise(async (resolve, reject) => {
            try {

                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();

                const filename = `${moment().format("YYYYMMDDHHmmss")}-${Math.floor(Math.random() * 100)}-cedula${type === "PRE" ? "prepaid" : "postpaid"}.png`
                const fetchFile = await axios.get(filePath, { responseType: 'arraybuffer' });
                let file = fetchFile.data

                // print.log(`File url ${filePath} `);
                //write in tmp
                const dir = `${process.env.TMP_DIR}/${filename}`
                fs.writeFileSync(dir, file);

                const image = sharp(file);
                if (!image) throw new Error('Image is not valid')
                const metadata = await image.metadata();
                const size = (metadata.size || file.byteLength) / (1024 * 1000);


                print.log(`Image size ${size.toFixed(2)}MB`);
                //check size of file dont exceed 1MB
                if (size > 1) {
                    //resize image to 800Kb
                    print.log(`Resizing image from ${size.toFixed(2)}MB to 800Kb`);
                    //if 1MB is 100% how much I have to reduce to get 800Kb
                    const percent = Math.floor((100 * 800) / (size * 1000))
                    const new_size = size / percent;
                    print.log(`New size ${new_size.toFixed(2)}MB`);
                    print.log(`Percent ${percent.toFixed(2)}%`);

                    file = await image.jpeg({ quality: percent }).toFile(dir);
                } else {
                    print.log(`Quality 100%`);
                    file = await image.jpeg({ quality: 100 }).toFile(dir);
                }

                const blob = fs.readFileSync(dir);
                const cedula = new Blob([blob], { type: 'image/jpeg' });


                form.append("file", cedula, filename);
                form.append('name', "cedulacliente");
                form.append('type', "identification");

                const request_time = new Date().toISOString();
                const params = `request_time=${request_time}`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts/${contractId}/attachments?${params}`;

                const query = await axios.post(url, form, { headers: headers });
                resolve(query);
                fs.unlinkSync(dir);

            } catch (e) {
                print.error(e);
                reject(e);
            }
        });
    }

    uploadContract(contractId: number, filePath: string) {
        return new Promise(async (resolve, reject) => {
            try {

                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();

                const filename = `contract.pdf`
                const fetchFile = await axios.get(filePath, { responseType: 'arraybuffer' });
                const file = fetchFile.data
                const contract = new Blob([file], { type: 'application/pdf' });

                form.append("file", contract, filename);
                form.append('name', "service_request");
                form.append('type', "service_request");

                const request_time = new Date().toJSON().slice(0, 19)
                const params = `request_time=${request_time}-06:00`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts/${contractId}/attachments?${params}`;

                const query = await axios.post(url, form, { headers: headers });
                resolve(query);
                fs.unlinkSync(filename);

            } catch (e) {
                reject(e);
            }
        });
    }

    uploadAuthContract(contractId: number, filePath: string) {
        return new Promise(async (resolve, reject) => {
            try {

                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();

                const filename = `contract.pdf`
                const fetchFile = await axios.get(filePath, { responseType: 'arraybuffer' });
                const file = fetchFile.data
                const contract = new Blob([file], { type: 'application/pdf' });

                form.append("file", contract, filename);
                form.append('name', "Authorization");
                form.append('type', "authorization");

                const request_time = new Date().toJSON().slice(0, 19)
                const params = `request_time=${request_time}-06:00`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts/${contractId}/attachments?${params}`;

                const query = await axios.post(url, form, { headers: headers });
                resolve(query);
                fs.unlinkSync(filename);

            } catch (e) {
                reject(e);
            }
        });
    }


    async getDataWithoutProcess(offset: string = "30"): Promise<Array<{
        Telefono: string,
        icc: string,
        "Nombre cliente": string,
        "Fecha de envio a liberate": Date,
        Area: string,
        "Tiempo transcurrido": string
    }>> {

        const query = `
            SELECT
                ppiii.MSISDN as Telefono,
                ppiii.ICCID_N as icc,
                REPLACE(ppiii.name, "{|}", '') as "Nombre cliente",
	            DATE_FORMAT(ppiii.LIB_FILE_SENT_ON - INTERVAL 5 HOUR, '%d/%m/%Y %H:%i:%s') as "Fecha de envio a liberate",
                a.name as Area,
                CONCAT(
                    FLOOR(TIMESTAMPDIFF(MINUTE, LIB_FILE_SENT_ON, NOW()) / 60), ':',
                    LPAD(MOD(TIMESTAMPDIFF(MINUTE, LIB_FILE_SENT_ON, NOW()), 60), 2, '0')
                ) AS "Tiempo transcurrido (HH:MM)"
            FROM
                 PRE2POST_ISOFT_INPUT_INTPORT ppiii 
            JOIN user u ON u.id = ppiii.user_id 
            JOIN area a ON u.area_id = a.id 
            WHERE
                ppiii.STATUS in (2, 4)
            AND ppiii.LIB_FILE IS NOT NULL 
            AND ppiii.LIB_FILE_SENT_ON IS NOT NULL 
            AND ppiii.LIB_FILE_SENT_ON <= NOW() - INTERVAL ${offset} MINUTE 
            AND ppiii.LIB_FILE_SENT_ON > NOW() - INTERVAL 8 DAY 
            ;
        `

        return new Promise((resolve, reject) => {
            conn?.query(query, (err, results: any) => {
                if (err) {
                    reject(err)
                    return;
                }
                resolve(results)
            })
        })
    }

    async getPromosNextToExpire(days: number): Promise<Array<{
        promo_id: number,
        code_plan: string,
        name_plan: string,
        port_types: string,
        promo_code: string,
        promo_name: string,
        promo_months: number,
        start_date: string,
        end_date: string
    }>> {


        // 
        //    
        //     
        //     
        //     "Nombre Promoción"
        //     "Meses asignación"
        //     "Fecha Inicio"
        //     "Fecha Fin"
        //get all promos that are going to expire in the next X days
        const query = `
            SELECT
                pp.code as "Código Plan",
                pp.name as "Nombre Plan Servicio",
                GROUP_CONCAT(pt.name ORDER BY pt.name SEPARATOR ', ') AS "Operación",
                p.code as "Codigo Promoción",
                p.name as "Nombre Promoción",
                p.months as "Meses asignación",
                DATE_FORMAT(p.start_date , '%d/%m/%Y') as "Fecha Inicio",
                DATE_FORMAT(p.end_date , '%d/%m/%Y') as "Fecha Fin"
            FROM
                promos p
            JOIN postpaid_plan pp ON pp.id = p.plan_id 
            JOIN plan_promo pp2 ON pp2.promo_id = p.id 
            JOIN port_type pt ON pt.id = pp2.porta_type_id 
            WHERE
                p.end_date <= NOW() + INTERVAL ${days} DAY
            AND p.end_date >= NOW()
            ORDER BY p.end_date DESC;
        `
        return new Promise((resolve, reject) => {
            conn?.query(query, (err, results: any) => {
                if (err) {
                    reject(err)
                    return;
                }
                resolve(results)
            })
        })



    }


    async updateLine(lines: any[]): Promise<any> {
        return new Promise((resolve, reject) => {

            const queue = []

            for (const line of lines) {

                const query = ` UPDATE AP_ISOFT_INPUT_POSTPAID 
                            SET file_content = "${line.liberateLine}" 
                            WHERE CONTRACTID = ${line.CONTRACTID};`

                queue.push(conn?.query(query))
            }

            Promise.allSettled(queue).then((results) => {
                resolve(results)
            }).catch((e) => {
                reject(e)
            })
        })


    }

    async updateLineP2P(lines: any[]): Promise<any> {
        return new Promise((resolve, reject) => {

            const queue = []

            for (const line of lines) {

                const query = ` UPDATE PRE2POST_ISOFT_INPUT_INTPORT 
                            SET file_content = "${line.liberateLine}" 
                            WHERE CONTRACTID = ${line.CONTRACTID};`

                queue.push(conn?.query(query))
            }

            Promise.allSettled(queue).then((results) => {
                resolve(results)
            }).catch((e) => {
                reject(e)
            })
        })


    }
    async updateLineStep(lines: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const queue = []

            for (const line of lines) {

                const query = `UPDATE AP_ISOFT_INPUT_POSTPAID SET STEP = 6 WHERE CONTRACTID = ${line.CONTRACTID};`

                console.log(query)
                if (conn) {
                    queue.push(conn.promise().query(query))
                } else {
                    console.log("ERROOOOOOOOOOOOOOOR | conn is null")
                }

            }

            Promise.allSettled(queue).then((results) => {
                resolve(results)
            }).catch((e) => {
                reject(e)
            })

        })


    }

    async updateLineStepP2P(lines: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const queue = []

            for (const line of lines) {

                const query = `UPDATE PRE2POST_ISOFT_INPUT_INTPORT SET STEP = 6 WHERE CONTRACTID = ${line.CONTRACTID};`

                console.log(query)
                if (conn) {
                    queue.push(conn.promise().query(query))
                } else {
                    console.log("ERROOOOOOOOOOOOOOOR | conn is null")
                }
            }

            Promise.allSettled(queue).then((results) => {
                resolve(results)
            }).catch((e) => {
                reject(e)
            })

        })


    }


    async sendToLiberate(lines: { transaction_id: number, file_content: string }[]) {

        return new Promise(async (resolve, reject) => {
            try {

                if (!process.env.LIBERATE_WS_NOTIFICATION) {
                    reject("Liberate WS Notification is not defined")
                    return;
                }

                if (!process.env.LIBERATE_WS_APIKEY) {
                    reject("Liberate WS ApiKey is not defined")
                    return;
                }

                const headers = {
                    apikey: process.env.LIBERATE_WS_APIKEY

                }

                if (!lines.length) {
                    resolve("No lines to send")
                    return;
                }

                console.log("Sending to liberate", lines)
                const query = await axios.post(process.env.LIBERATE_WS_NOTIFICATION, {
                    in: lines
                }, { headers })

                const result = query.data
                console.log(JSON.stringify(result))
                if (result.response === 1) {
                    resolve(result)
                } else {
                    reject(result)
                }

            } catch (e) {
                reject(e)
            }


        })

    }
    uploadAuthApcContract(contractId: number, filePath: string) {
        return new Promise(async (resolve, reject) => {
            try {

                const headers = {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                    'X-API-Token': `${process.env.CONTRACT_API_KEY}`
                }

                if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

                const form = new FormData();

                const exntesion = filePath.split('.').pop();
                const fileType = exntesion === "pdf" ? "application/pdf" : `image/${exntesion}`;

                const filename = `contract.${exntesion}`
                const fetchFile = await axios.get(filePath, { responseType: 'arraybuffer' });
                const file = fetchFile.data
                const contract = new Blob([file], { type: fileType });

                form.append("file", contract, filename);
                form.append('name', "Authorization");
                form.append('type', "authorization");

                const request_time = new Date().toJSON().slice(0, 19)
                const params = `request_time=${request_time}-06:00`;

                const url = `${process.env.CONTRACT_API_URL}/api/v2/contracts/${contractId}/attachments?${params}`;

                const query = await axios.post(url, form, { headers: headers });
                resolve(query);
                fs.unlinkSync(filename);

            } catch (e) {
                reject(e);
            }
        });
    }

    async generateAuthContract(transaction_id: any, type: number = 1): Promise<string> {
        try {

            if (process.env.CONTRACT_API_URL === undefined) throw new Error('CONTRACT_API_URL is not defined');

            const query = await axios.post(`${process.env.BASE_API_URL}/porta-request/apc-contract/${transaction_id}`, { type: type });

            if (query.status === 200) {
                return query.data.url;
            } else {
                return "ERROR";
            }

        } catch (e) {
            print.log(e);
            return "ERROR";
        }
    }


    async sendToLiberateP2P(lines: { transaction_id: number, file_content: string }[]) {

        return new Promise(async (resolve, reject) => {
            try {

                if (!process.env.LIBERATE_WS_NOTIFICATION_P2P) {
                    reject("Liberate WS Notification is not defined")
                    return;
                }

                if (!process.env.LIBERATE_WS_APIKEY) {
                    reject("Liberate WS ApiKey is not defined")
                    return;
                }

                const headers = {
                    apikey: process.env.LIBERATE_WS_APIKEY

                }

                if (!lines.length) {
                    resolve("No lines to send")
                    return;
                }

                console.log("Sending to liberate", lines)
                const query = await axios.post(process.env.LIBERATE_WS_NOTIFICATION_P2P, {
                    in: lines
                }, { headers })

                const result = query.data
                console.log(JSON.stringify(result))
                if (result.response === 1) {
                    resolve(result)
                } else {
                    reject(result)
                }

            } catch (e) {
                reject(e)
            }


        })

    }

}
