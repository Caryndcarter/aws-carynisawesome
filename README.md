# Init Zero ⚛️ - Project Template 🏤👥

## ✏️ Repository Naming Conventions

* `SPONSOR-PROJECT` most deliverable projects, even if the GitHub organization is `SPONSOR`. I.e., `company-PROJECT`
* `hello-` simple demonstrations of a single technology
* `lib-` libraries, even internal, if they are general purpose
* `sandbox-` experiments or `poc-` proof of concept, a sandbox you want to preserve
* `template-` blueprints for future projects
* `toy-` educational projects

## 📋 Setup

1. Run `npm run init`
2. Write a decent `README.md` or copy-and-paste the "Sample Readme" at the bottom of this file
3. Commit
4. Push

### Further Customization 💅

The `init` script will set the package names. 
You may delete packages you don't want (usually `express/`, `lambda/`, or `nuxt/` inside `packages/`).
If you delete any packages you should re-generate the `package-lock.json` to uninstall obsolete packages.
To do this, you must delete the `node_modules` directory, delete `package-lock.json`, and run `npm install`.

Eventually you will customize `packages/cdk/lib/cdk-backend.js`. 
Keep `packages/cdk/test/cdk.test.js` running but do not test CDK constructs tests. 
Then you will turn to `express` or `lambda` for implementations. `cdk-infrastructure.js` controls networking and resources that rarely change but dramatically increase build time (the build script will skip this step if it hasn't changed).

### Adding "Sub-Packages" 📦

* `cdk/`, `express/`, `lambda/`,  and `nuxt/` are provided.
* `models/` is a common addition for shared types

TODO: document adding sub-packages, ideally with hygen

## 📎 Appendix

### Sample Readme 📄

* Search for `TODO` for customization points

```markdown
# Initial JavaScript CDK Project 🐙

TODO: update the project header and optionally write a description here

## 📋 Setup

`npm install`

## 📝 Changelog

| Date       | Version | Summary        |
| ---------- | ------- | -------------- |
| TODO: DATE |   0.0.1 | Initial commit |
```

## 📜 License

[MIT License](./LICENSE.txt). Published by Finlayson Studio.
