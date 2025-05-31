#!/usr/bin/env node

const { program } = require("commander");
const inquirer = require("inquirer");
const fs = require("fs");
const chalk = require("chalk");
const { exec } = require("child_process");
const ping = require("node-http-ping");
const path = require("path");
const registries = require("../registries.json");
const PKG = require("../package.json");

program.version(PKG.version);

const defaultList = ["npm", "yarn", "tencent", "cnpm", "taobao", "huawei"];
// 获取当前的npm镜像
const getOrigin = () => {
    return new Promise((resolve, reject) => {
        exec(
            "npm get registry",
            { encoding: "utf8" },
            (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stdout.trim());
                }
            }
        );
    });
};

program
    .command("ls")
    .description("查看已配置镜像源")
    .action(async () => {
        const current = await getOrigin();
        const keys = Object.keys(registries);
        const max = Math.max(...keys.map((key) => key.length)) + 3;
        const message = [];
        keys.forEach((k) => {
            const newK =
                registries[k].registry === current ? "* " + k : "  " + k;
            const keySplit = newK.split("");
            keySplit.length = max;
            const str = Array.from(keySplit)
                .map((item) => (item ? item : "-"))
                .join("");
            message.push(str + "    " + registries[k].registry);
        });
        console.log(message.join("\n"));
    });
program
    .command("use")
    .description("设置当前使用的镜像源")
    .action(() => {
        inquirer
            .prompt([
                {
                    type: "list",
                    name: "sel",
                    message: "请选择镜像",
                    choices: Object.keys(registries),
                },
            ])
            .then((result) => {
                const reg = registries[result.sel].registry;
                exec(
                    `npm config set registry ${reg}`,
                    null,
                    (err, stdout, stderr) => {
                        if (err) {
                            console.log(chalk.red("切换错误", err));
                        } else {
                            console.log(chalk.green("切换成功"));
                        }
                    }
                );
            });
    });
program
    .command("current")
    .description("查看当前镜像源")
    .action(async () => {
        const reg = await getOrigin();
        const current = Object.keys(registries).find(
            (item) => registries[item].registry === reg
        );
        if (current) {
            console.log(chalk.blue("当前源:" + current));
        } else {
            console.log(chalk.green("当前源:" + reg));
        }
    });
program
    .command("ping")
    .description("测试镜像源地址速度")
    .action(() => {
        inquirer
            .prompt([
                {
                    type: "list",
                    name: "sel",
                    message: "请选择镜像源",
                    choices: Object.keys(registries),
                },
            ])
            .then((result) => {
                const url = registries[result.sel].ping;
                ping(url)
                    .then((time) =>
                        console.log(chalk.blue(`响应时长: ${time}ms`))
                    )
                    .catch(() => console.log(chalk.red("connect timeout")));
            });
    });
program
    .command("add")
    .description("添加自定义镜像源")
    .action(() => {
        inquirer
            .prompt([
                {
                    type: "input",
                    name: "name",
                    message: "请输入镜像源名称",
                    validate(answer) {
                        const keys = Object.keys(registries);
                        if (keys.includes(answer)) {
                            return `不能起名${answer}跟保留字冲突`;
                        }
                        if (!answer.trim()) {
                            return `名称不能为空`;
                        }
                        return true;
                    },
                },
                {
                    type: "input",
                    name: "url",
                    message: "请输入镜像源地址",
                    validate(answer) {
                        const isExist = Object.keys(registries).findIndex(
                            (item) =>
                                registries[item].registry === answer.trim()
                        );
                        if (isExist > -1) {
                            return `镜像源地址${answer}已存在，请重新输入`;
                        }
                        if (!answer.trim()) {
                            return "url不能为空";
                        }
                        return true;
                    },
                },
            ])
            .then((result) => {
                const delTrailingSlash = (url) => {
                    return url.replace(/\/$/, "");
                };
                registries[result.name] = {
                    home: result.url.trim(),
                    registry: result.url.trim(),
                    ping: delTrailingSlash(result.url.trim()),
                };
                fs.writeFile(
                    path.join(__dirname, "../registries.json"),
                    JSON.stringify(registries, null, 4),
                    (err) => {
                        if (err) {
                            console.log(chalk.red("添加失败, 失败原因:" + err));
                        } else {
                            console.log(chalk.green("添加完成"));
                        }
                    }
                );
            });
    });
program
    .command("delete")
    .description("删除自定义镜像源")
    .action(() => {
        const keys = Object.keys(registries);
        if (keys.length === defaultList.length) {
            return console.log(chalk.red("当前无自定义源可以删除"));
        }
        const differentArr = keys.filter((item) => !defaultList.includes(item));
        inquirer
            .prompt([
                {
                    type: "list",
                    name: "sel",
                    message: "请选择删除的镜像",
                    choices: differentArr,
                },
            ])
            .then(async (result) => {
                const current = await getOrigin();
                if (current === registries[result.sel.trim()].registry) {
                    return console.log(
                        chalk.red(
                            `当前还在使用该镜像${
                                registries[result.sel.trim()].registry
                            },请切换其他镜像删除`
                        )
                    );
                }
                delete registries[result.sel];
                fs.writeFile(
                    path.join(__dirname, "../registries.json"),
                    JSON.stringify(registries, null, 4),
                    (err) => {
                        if (err) {
                            console.log(chalk.red("删除失败, 失败原因:" + err));
                        } else {
                            console.log(chalk.green("删除成功"));
                        }
                    }
                );
            });
    });
program
    .command("rename")
    .description("重命名自定义镜像源")
    .action(() => {
        const keys = Object.keys(registries);
        if (keys.length === defaultList.length) {
            return console.log(chalk.red("当前无自定义源可以重命名"));
        }
        const differentArr = keys.filter((item) => !defaultList.includes(item));
        inquirer
            .prompt([
                {
                    type: "list",
                    name: "sel",
                    message: "请选择名称",
                    choices: differentArr,
                },
                {
                    type: "input",
                    name: "rename",
                    message: "请输入新名称",
                    validate(answer) {
                        const keys = Object.keys(registries);
                        if (keys.includes(answer.trim())) {
                            return `不能起名${answer}跟保留字冲突`;
                        }
                        if (!answer.trim()) {
                            return "名称不能为空";
                        }
                        return true;
                    },
                },
            ])
            .then((result) => {
                registries[result.rename.trim()] = Object.assign(
                    {},
                    registries[result.sel.trim()]
                );
                delete registries[result.sel.trim()];
                fs.writeFile(
                    path.join(__dirname, "../registries.json"),
                    JSON.stringify(registries, null, 4),
                    (err) => {
                        if (!err) {
                            console.log(
                                chalk.greenBright(`重命名完成 ${result.rename}`)
                            );
                        } else {
                            console.log(
                                chalk.red("重命名失败, 失败原因: " + err)
                            );
                        }
                    }
                );
            });
    });
program
    .command("edit")
    .description("编辑自定义镜像源")
    .action(async () => {
        const keys = Object.keys(registries);
        if (keys.length === defaultList.length) {
            return console.log(chalk.red("当前无自定义源可以编辑"));
        }
        const differentArr = keys.filter((item) => !defaultList.includes(item));
        const { sel } = await inquirer.prompt([
            {
                type: "list",
                name: "sel",
                message: "请选择需要编辑的源",
                choices: differentArr,
            },
        ]);
        const { registerUrl } = await inquirer.prompt([
            {
                type: "input",
                name: "registerUrl",
                message: "输入修改后的镜像地址",
                default: () => registries[sel].registry,
                validate(registerUrl) {
                    if (!registerUrl.trim()) return "镜像地址不能为空";
                    return true;
                },
            },
        ]);
        const delTrailingSlash = (url) => {
            return url.replace(/\/$/, "");
        };
        registries[sel] = {
            home: registerUrl.trim(),
            registry: registerUrl.trim(),
            ping: delTrailingSlash(registerUrl.trim()),
        };
        fs.writeFile(
            path.join(__dirname, "../registries.json"),
            JSON.stringify(registries, null, 4),
            (err) => {
                if (!err) {
                    console.log(chalk.greenBright(`修改完成`));
                } else {
                    console.log(chalk.red("修改失败, 失败原因: " + err));
                }
            }
        );
    });
program.parse(process.argv);
