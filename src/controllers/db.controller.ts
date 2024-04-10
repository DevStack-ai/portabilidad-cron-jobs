import "dotenv/config";

import { PrismaClient } from "@prisma/client";


export class DbController {


    constructor() {
    }

    async getReport(): Promise<[]> {
        const prisma = new PrismaClient();

        const query = await prisma.$queryRaw`
        SELECT 
            pr.phone AS 'number_port',
            '' AS 'ticket',
            '' AS 'estado',
            '' AS 'creado',
            '' AS 'canal',
            '' AS etapa_actual,
            '' AS 'agente',
            pr.name AS 'nombre_de_cliente',
            CONCAT(CASE
                        WHEN
                            pr.document_type = 1
                        THEN
                            CONCAT(pr.c_provincia,
                                    pr.c_letra,
                                    '-',
                                    pr.c_folio,
                                    '-',
                                    pr.c_asiento)
                        ELSE CONCAT(pr.passport, pr.ruc)
                    END) AS 'cedula',
            '' AS 'direccion entrega',
            REPLACE(REPLACE(CONCAT(pr.home_number,
                            ' ',
                            pr.address,
                            ' ',
                            l3.nombre,
                            ' ',
                            l2.nombre,
                            ' ',
                            l1.nombre),
                    ',',
                    ''),
                '
                        ',
                '') AS 'direccion cliente',
            '' AS 'imei',
            generadigitosensim(simcard) AS 'serie_de_simcard',
            pp.package_id AS 'nombre_del_plan',
            email AS 'email_del_cliente',
            '' AS 'tipo_de_plan',
            '' AS tipo_equipo,
            '' AS grupo_etapa_final
        FROM
            porta_request pr
                JOIN
            location l1 ON l1.id = pr.provincia
                JOIN
            location l2 ON l2.id = pr.distrito
                JOIN
            location l3 ON l3.id = pr.corregimiento
                JOIN
            postpaid_plan pp ON pp.id = pr.post_paid_plan_id
        where port_type_id=1
        and ready_to_send=1
        and ready_to_send_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        ORDER BY pr.id DESC;`;

        prisma.$disconnect();


        return query as []
    }
}