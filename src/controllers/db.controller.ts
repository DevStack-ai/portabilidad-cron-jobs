import "dotenv/config";

import { ISOFT_INPUT, PrismaClient } from "@prisma/client";


interface data {
    data: Array<any>
    ids: Array<number>
}

export class DbController {


    constructor() {
    }

    async getReport(): Promise<[]> {
        const prisma = new PrismaClient();

        const query: [] = await prisma.$queryRaw`
            SELECT 
                IDISOFT, 
                NUMBER_PORT AS 'number_port',
                '' AS 'ticket',
                '' AS 'estado',
                '' AS 'creado',
                '' AS 'canal',
                '' AS etapa_actual,
                '' AS 'agente',
                NOMBRE_DE_CLIENTE AS 'nombre_de_cliente',
                CEDULA AS 'cedula',
                '' AS 'direccion entrega',
                DIRECCION_CLIENTE AS 'direccion cliente',
                '' AS 'imei',
                GENERADIGITOSENSIM(SERIE_DE_SIMCARD) AS 'serie_de_simcard',
                NOMBRE_DEL_PLAN AS 'nombre_del_plan',
                EMAIL_DEL_CLIENTE AS 'email_del_cliente',
                '' AS 'tipo_de_plan',
                '' AS tipo_equipo,
                '' AS grupo_etapa_final
            FROM
                ISOFT_INPUT
            WHERE
                PRE_POST = 'POST' AND ESTADO_FTP = 1
                    AND SERIE_DE_SIMCARD REGEXP '^[0-9]+$';`;

        prisma.$disconnect();
        return query as []
    }

    async updateReport(ids: any[]): Promise<void> {


        const prisma = new PrismaClient();

        await prisma.iSOFT_INPUT.updateMany({
            where: {
                IDISOFT: {
                    in: ids
                },
                ESTADO_FTP: 1
            },
            data: {
                ESTADO_FTP: 2,
                FECHA_ENVIADOFTP: new Date()
            }
        });
        prisma.$disconnect();


    }

    async updateField(id: number, field: string, value: any): Promise<void> {
        const prisma = new PrismaClient();

        await prisma.iSOFT_INPUT.update({
            where: {
                IDISOFT: id
            },
            data: {
                [field]: value
            }
        });

        prisma.$disconnect();
    }


    async getDataWithoutContract(): Promise<ISOFT_INPUT[]> {
        const prisma = new PrismaClient();

        const query = await prisma.iSOFT_INPUT.findMany({
            where: {
                CONTRATO_GENERADO: 9,
                CONTRACT_ID: null,
                CONTRACT_ATTEMPTS: {
                    lt: 3
                },
                STEP: 0
            },
            take: Number(process.env.CONTRACT_BATCH_SIZE)

        })
        return query
    }

    async getDataByStep(step: number): Promise<ISOFT_INPUT[]> {
        const prisma = new PrismaClient();

        const query = await prisma.iSOFT_INPUT.findMany({
            where: {
                CONTRATO_GENERADO: 1,
                STEP: step,
                CONTRACT_ATTEMPTS: {
                    lt: 3
                }
            },
            take: Number(process.env.CONTRACT_BATCH_SIZE)

        })
        return query
    }

    async failedProcess(ids: number[]): Promise<void> {
        const prisma = new PrismaClient();

        await prisma.iSOFT_INPUT.updateMany({
            where: {
                IDISOFT: {
                    in: ids
                }
            },
            data: {
                CONTRACT_ATTEMPTS: {
                    increment: 1
                },
                // STEP: step
            }
        });

        prisma.$disconnect();
    }
    async successStep(ids: number[], step: number): Promise<void> {
        const prisma = new PrismaClient();

        await prisma.iSOFT_INPUT.updateMany({
            where: {
                IDISOFT: {
                    in: ids
                }
            },
            data: {
                STEP: step
            }
        });

        prisma.$disconnect();
    }
}