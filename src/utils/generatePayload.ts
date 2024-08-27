
//return a xml

import { Pre2Post } from "@/controllers/prepost.controller";
import moment from "moment";

type PayloadType = "PRE" | "POST"
interface contract {
    request_number: string;
    date: string;
    client_name: string;
    id: string;
    address: string;
    ctn: string;
    email: string;
    type: PayloadType;
}
export function generateXMLTemplate(data: contract, type?: any) {

    const template = `
    <?xml version="1.0" encoding="UTF-8"?>
      <transaction>
          <items>
              <item>
                  <metadata>
                  <carrier>CWP</carrier>
                  <transactiontype>External Mobile Port ${data.type === "PRE" ? "Prepaid" : "Postpaid"} SPN</transactiontype>
                  <request_number>${data.request_number}</request_number>
                  <date>${data.date}</date>
                  <client_name>${data.client_name.normalize("NFKC")}</client_name>
                  <id>${data.id}</id>
                  <cedula>${data.id}</cedula>
                  <adress>${data.address.normalize("NFKC")}</adress>
                  <province>${data.address.normalize("NFKC")}</province>
                  <district>${data.address.normalize("NFKC")}</district>
                  <corregimiento>${data.address.normalize("NFKC")}</corregimiento>
                  <barriada>${data.address.normalize("NFKC")}</barriada>
                  <street>${data.address.normalize("NFKC")}</street>
                  <house>${data.address.normalize("NFKC")}</house>
                  <apto></apto>
                  <ctn>${data.ctn}</ctn>
                  <contact_client>${data.ctn}</contact_client>
                  <email>${data.email.normalize("NFKC")}</email>
                  <quantity_line>1</quantity_line>
                  <account_number>${data.ctn}</account_number>
                  <line_one>${data.ctn}</line_one>
                  <line_two></line_two>
                  <line_tre></line_tre>
                  <line_four></line_four>
                  <more_line_true></more_line_true>
                  <more_line_false>X</more_line_false>
                  <Current_telephone_service_dealer>Digicel Panama SA</Current_telephone_service_dealer>
                  <telephone_service_dealer>Cable and Wireless Panamá, S.A</telephone_service_dealer>
                  <telephone_contact_receiving_dealer>${data.type === "PRE" ? "123" : "161"}</telephone_contact_receiving_dealer>
                  <mail_dealer>DLPNCWP@cwpanama.com</mail_dealer>
                  <nip_pcs>${data.type === "POST" ? "" : "0000"}</nip_pcs>
                  <approved_true></approved_true>
                  <approved_false></approved_false>
                  <last_unpaid_invoice></last_unpaid_invoice>
                  <name_not_owner_line></name_not_owner_line>
                  <telephone_not_exist></telephone_not_exist>
                  <outside_local_charging_zone></outside_local_charging_zone>
                  <fixed_concessionaire_provide_prepayment></fixed_concessionaire_provide_prepayment>
                  <outstanding_balance_last_invoice></outstanding_balance_last_invoice>
                  <name_not_owner></name_not_owner>
                  <lost_or_stolen_device></lost_or_stolen_device>
                  <phone_not_exist></phone_not_exist>
                  <wrong_nip></wrong_nip>
                  <without_nip></without_nip>
                  <client_name_represent>${data.client_name.normalize("NFKC")}</client_name_represent>
                  <dealership>Telefonica Moviles Panama S.A</dealership>
                  <client_id_represent>${data.id}</client_id_represent>
                  <liberate_code_user></liberate_code_user>           
                  </metadata>
              </item>
          </items>
      </transaction>
    `


    return template
}

interface contractP2P extends Pre2Post {
    plan_name: string;
    plan_month_charge: string;
    plan_credit_limit: string;
    plan_min_included: string;
    plan_min_all_net: string;
    plan_min_on_net: string;
    plan_min_cost_excedent: string;
    plan_min_cost_mobile: string;
    plan_sms: string;
    plan_gprs: string;
    plan_cost_excedent: string;

    plan_code: string;
    plan_description: string;
    plan_mrc: string;
    plan_mb_included: string;
    plan_kb_excedent: string;

    cedula: string;

    distrito_name: string;
    provincia_name: string;
    
    seller_name: string;
    seller_document: string;

    client_name: string;
}

export function generateXMLTemplateP2P(data: contractP2P , type?: any) {
    const date = moment(data.ADDED_ON)
    console.log(data.client_name)
    const firstname = data.client_name.split('{|}')[0].trim()
    const lastname = data.client_name.split('{|}')[1].trim()
    const template = `<?xml version="1.0" encoding="UTF-8"?>
    <transaction>
        <items>
            <item>
                <metadata>
                    <carrier>CWP</carrier>
                    <transactiontype>Internal Port T&amp;C</transactiontype>
                    <sale_id>VCP${8000000 + data.TRANSACTION_ID}</sale_id>
                    <date>${date.format("DD/MM/YYYY")}</date>
                    <name>${firstname || ""}</name>
                    <lastname>${lastname || ""}</lastname>
                    <idcard>${data.cedula}</idcard>
                    <email>${data.email}</email>
                    <gender></gender>
                    <distribution_code>999</distribution_code>
                    <workplace></workplace>
                    <email_p>${data.email}</email_p>
                    <phone>${data.contact_phone}</phone>
                    <fax></fax>
                    <province>${data.provincia_name}</province>
                    <district>${data.distrito_name}</district>
                    <neighborhood>${data.address}</neighborhood>
                    <street>${data.address}</street>
                    <home>${data.home_number}</home>
                    <payment_method>Efectivo</payment_method>
                    <equipment>NA</equipment>
                    <plu>NA</plu>
                    <brand>NA</brand>
                    <model>NA</model>
                    <imei>000000000000000</imei>
                    <phone_number>${data.MSISDN}</phone_number>
                    <contract_duration>18</contract_duration>
                    <plan_name>Mas Control VYD LDI 500 DATA Sin Limites</plan_name>
                    <monthly_plan_charge>${Number(data.plan_month_charge).toFixed(2)}</monthly_plan_charge>
                    <credit_limit>${data.plan_credit_limit}</credit_limit>
                    <minutes_included>${data.plan_min_included}</minutes_included>
                    <minutes_includ_allnet>${data.plan_min_all_net}</minutes_includ_allnet>
                    <minutes_includ_onnet>${data.plan_min_on_net}</minutes_includ_onnet>
                    <cost_excess_minutes>${data.plan_min_cost_excedent}</cost_excess_minutes>
                    <cost_min_another_mobile>${data.plan_min_cost_mobile}</cost_min_another_mobile>
                    <cost_min_another_operator>0</cost_min_another_operator>
                    <cost_min_fixed_network>0</cost_min_fixed_network>
                    <sms>${data.plan_sms}</sms>
                    <gprs>${data.plan_gprs}</gprs>
                    <cost_excent></cost_excent>
                    <plan_code>${data.plan_description}</plan_code>
                    <description_data>${data.plan_description}</description_data>
                    <mrc>${Number(data.plan_mrc).toFixed(2)}</mrc>
                    <mb_included>${data.plan_mb_included}</mb_included>
                    <excess_kb>${data.plan_kb_excedent}</excess_kb>
                    <total_price_client>0.00</total_price_client>
                    <list_price>0.00</list_price>
                    <activation_charge>0.00</activation_charge>
                    <deposit>0.00</deposit>
                    <deposit_exoneration>(0.00)</deposit_exoneration>
                    <credit_limit_increase>0.00</credit_limit_increase>
                    <additional_services>0.00</additional_services>
                    <accessories>0.00</accessories>
                    <itbms>0.00</itbms>
                    <isc>0.00</isc>
                    <total_charges>0.00</total_charges>
                    <quotas></quotas>
                    <contract_number>VCP${8000000 + data.TRANSACTION_ID}</contract_number>
                    <cellphone_number>${data.MSISDN}</cellphone_number>
                    <imei_serie>000000000000000</imei_serie>
                    <equipment_list_price>0.00</equipment_list_price>
                    <price_equip_according_service_plan>0.00</price_equip_according_service_plan>
                    <client_name_portin>${firstname || ""}</client_name_portin>
                    <client_lastname_portin>${lastname || ""}</client_lastname_portin>
                    <id>${data.cedula}</id>
                    <prepaid_number>${data.MSISDN}</prepaid_number>
                    <day>${date.format("DD")}</day>
                    <month>${date.format("MM")}</month>
                    <year>${date.format("YYYY")}</year>
                    <client_name>${firstname || ""}</client_name>
                    <client_lastname>${lastname || ""}</client_lastname>
                    <client_idcard>${data.cedula}</client_idcard>
                    <client_email>${data.email}</client_email>
                    <created_by_name>${data.seller_name}</created_by_name>
                    <created_by_lastname></created_by_lastname>
                    <liberate_code_user>CWP00</liberate_code_user>
                </metadata>
            </item>
        </items>
    </transaction>
    `


    return template
}