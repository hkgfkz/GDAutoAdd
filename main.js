/*
 *     Copyright (c) 2020 Steven Zhu
 *
 *     This program is free software: you can redistribute it and/or modify
 *     it under the terms of the GNU General Public License as published by
 *     the Free Software Foundation, either version 3 of the License, or
 *     (at your option) any later version.
 *
 *     This program is distributed in the hope that it will be useful,
 *     but WITHOUT ANY WARRANTY; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *     GNU General Public License for more details.
 *
 *     You should have received a copy of the GNU General Public License
 *     along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const authConfig = {
    version: "0.1.1",
    dailyLimit: false, // 是否限制每一个邮箱每天只能提交一次请求
    client_id: "",
    client_secret: "",
    refresh_token: "", // 授权 token
};

const captcha_config = {
    type: 'none', // hcaptcha || recaptcha || none
};

const gd_config = {
    type: "", // "group", "drive" 添加至Shared Drive还是Group
    id: "", //Shared Drive ID或Groups ID
    drive_permission: "reader", // Google Drive 权限
    group_permission: "MEMBER" // Google Groups 权限
}

const hcaptcha_config = {
    type: 'h-captcha', // 无需修改
    verify_url: 'https://hcaptcha.com/siteverify', // 无需修改
    js_url: '<script src=\'https://www.hcaptcha.com/1/api.js\' async defer></script>', // 无需修改
    site_key: '',
    secret_key: ''
}

const recaptcha_config = {
    type: 'g-recaptcha', // 无需修改
    verify_url: 'https://www.recaptcha.net/recaptcha/api/siteverify', // 无需修改
    js_url: '<script src=\'https://www.google.com/recaptcha/api.js\' async defer></script>', // 无需修改
    site_key: '',
    secret_key: ''
}

const member_filter = {
    status: true, // true 为开启筛选， false为关闭筛选
    mode: 'allow', // block 为黑名单（别问我为什么叫block）， allow 为白名单
    member_filter: ['test@example.com'], // 单邮箱筛选
    domain_filter: ['gmail.com'] // 域名屏蔽
}


var gd;

var today;

addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
});

var dailyLimit = [];

/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(request) {
    if (authConfig.dailyLimit) {
        if (!today) today = new Date().getDate();

        // Remove email rate limit every day
        if (new Date().getDate() != today) {
            today = new Date().getDate();
            dailyLimit.length = 0;
        }
    }

    if (gd == undefined) {
        gd = new googleDrive(authConfig);
    }
    let url = new URL(request.url);
    let path = url.pathname;


    switch (path) {
        case "/drive":
            if (request.method === "POST") {
                const requestBody = await request.json();

                if (authConfig.dailyLimit) {
                    if (dailyLimit.includes(requestBody.emailAddress)) {
                        return new Response("每天只允许提交一次", {
                            status: 429
                        });
                    } else {
                        dailyLimit.push(requestBody.emailAddress);
                    }
                }
                if (!checkEmail(requestBody.emailAddress)) {
                    return new Response("您位于黑名单", {
                        status: 429
                    });
                }

                if (!await gd.validateRecaptcha(requestBody.captcha_token)) {
                    return new Response("验证码错误", {
                        status: 403
                    });
                }
                if (gd_config.type === "group") {
                    try {
                        let result = await gd.addMemberToGroups(requestBody);
                        return new Response("OK", {
                            status: 200
                        });
                    } catch (err) {
                        return new Response(err.toString(), {
                            status: 500
                        });
                    }
                } else if (gd_config.type === "drive") {
                    try {
                        let result = await gd.addMemberToTeamDrive(requestBody);
                        return new Response("OK", {
                            status: 200
                        });
                    } catch (err) {
                        return new Response(err.toString(), {
                            status: 500
                        });
                    }
                } else {
                    return new Response("Server Config Error", {
                        status: 500
                    });
                }
            } else if (request.method === "OPTIONS") {
                return new Response("", {
                    status: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*"
                    }
                });
            } else {
                return new Response("Bad Request", {
                    status: 400
                });
            }
        default:
            const html_response = await fetch('https://cdn.jsdelivr.net/gh/clatteringmarion/GDAutoAdd@0.1.1/index.html');
            var html = await html_response.text();

            var html_captchascript = '';
            if (captcha_config.type === "hcaptcha") {
                html_captchascript = `${hcaptcha_config.js_url}`;
            } else if (captcha_config.type === "recaptcha") {
                html_captchascript = `${recaptcha_config.js_url}`;
            } else {
            }

            var html_captchaprompt = '';
            if (captcha_config.type === "hcaptcha") {
                html_captchaprompt = `<div class="${hcaptcha_config.type}" data-sitekey="${hcaptcha_config.site_key}"></div>`;
            } else if (captcha_config.type === "recaptcha") {
                html_captchaprompt = `<div class="${recaptcha_config.type}" data-sitekey="${recaptcha_config.site_key}"></div>`;
            } else {
            }

            var html_captchatoken = '';
            if (captcha_config.type === "hcaptcha") {
                html_captchatoken = 'hcaptcha.getResponse()';
            } else if (captcha_config.type === "recaptcha") {
                html_captchatoken = 'grecaptcha.getResponse()';
            } else {
                html_captchatoken = '"empty"';
            }

            return new Response(myInterpolate({
                scriptversion: authConfig.version,
                captcha_script: html_captchascript,
                captcha_prompt: html_captchaprompt,
                captcha_token: html_captchatoken,
            }, html), {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Access-Control-Allow-Origin": "*"
                }
            });
    }
}

// https://stackoverflow.com/a/2117523
function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        // tslint:disable-next-line:one-variable-per-declaration
        const r = (Math.random() * 16) | 0,
            // tslint:disable-next-line:triple-equals
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function checkEmail(email_address) {
    var idx = email_address.lastIndexOf('@');
    if (member_filter.status) {
        if (member_filter.mode === "block") {
            if (member_filter.domain_filter.includes(email_address.slice(idx + 1))) {
                return false;
            } else if (member_filter.member_filter.includes(email_address)) {
                return false;
            } else {
                return true;
            }
        } else if (member_filter.mode === "allow") {
            if (member_filter.domain_filter.includes(email_address.slice(idx + 1))) {
                return true;
            } else if (member_filter.member_filter.includes(email_address)) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    } else {
        return true
    }
}

function myInterpolate(params, text) {
    for (key of Object.keys(params)) {
        text = text.replace('${' + key + '}', params[key])
    }
    return text;
}

class googleDrive {
    constructor(authConfig) {
        this.authConfig = authConfig;
        this.accessToken();
    }

    async addMemberToGroups(requestBody) {
        console.log(`Adding member ${requestBody.emailAddress} to Google Groups`);
        let url = `https://www.googleapis.com/admin/directory/v1/groups/${gd_config.id}/members`;
        let requestOption = await this.requestOption(
            {"Content-Type": "application/json"},
            "POST"
        );
        let post_data = {
            role: gd_config.group_permission,
            email: requestBody.emailAddress
        };
        requestOption.body = JSON.stringify(post_data);
        let response = await fetch(url, requestOption);
        return await response.text();
    }

    async addMemberToTeamDrive(requestBody) {
        // Share team drive with email address
        console.log(`Sharing the team drive to ${requestBody.emailAddress}`);
        let url = `https://www.googleapis.com/drive/v3/files/${gd_config.id}/permissions`;
        let params = {supportsAllDrives: true};
        url += "?" + this.enQuery(params);
        let requestOption = await this.requestOption(
            {"Content-Type": "application/json"},
            "POST"
        );
        let post_data = {
            role: gd_config.drive_permission,
            type: "user",
            emailAddress: requestBody.emailAddress
        };
        requestOption.body = JSON.stringify(post_data);
        let response = await fetch(url, requestOption);
        return await response.text();
    }

    async accessToken() {
        console.log("accessToken");
        if (
            this.authConfig.expires == undefined ||
            this.authConfig.expires < Date.now()
        ) {
            const obj = await this.fetchAccessToken();
            if (obj.access_token != undefined) {
                this.authConfig.accessToken = obj.access_token;
                this.authConfig.expires = Date.now() + 3500 * 1000;
            }
        }
        return this.authConfig.accessToken;
    }

    async validateRecaptcha(token) {
        var url = '';
        var post_data = {}
        if (captcha_config.type === "hcaptcha") {
            url = hcaptcha_config.verify_url;
            post_data = {
                secret: hcaptcha_config.secret_key,
                response: token
            };
        } else if (captcha_config.type === "recaptcha") {
            url = recaptcha_config.verify_url;
            post_data = {
                secret: recaptcha_config.secret_key,
                response: token
            };
        } else {
            return true;
        }
        const reqOpt = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: this.enQuery(post_data)
        };
        const response = await fetch(url, reqOpt);
        const results = await response.json();
        console.log('validateRecaptcha ' + results.success);
        return results.success;
    }

    async fetchAccessToken() {
        console.log("fetchAccessToken");
        const url = "https://www.googleapis.com/oauth2/v4/token";
        const headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        };
        const post_data = {
            client_id: this.authConfig.client_id,
            client_secret: this.authConfig.client_secret,
            refresh_token: this.authConfig.refresh_token,
            grant_type: "refresh_token"
        };

        let requestOption = {
            method: "POST",
            headers: headers,
            body: this.enQuery(post_data)
        };

        const response = await fetch(url, requestOption);
        return await response.json();
    }

    async requestOption(headers = {}, method = "GET") {
        const accessToken = await this.accessToken();
        headers["authorization"] = "Bearer " + accessToken;
        return {method: method, headers: headers};
    }

    enQuery(data) {
        const ret = [];
        for (let d in data) {
            ret.push(encodeURIComponent(d) + "=" + encodeURIComponent(data[d]));
        }
        return ret.join("&");
    }
}
