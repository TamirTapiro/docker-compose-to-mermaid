# Changelog

## [0.2.0](https://github.com/TamirTapiro/docker-compose-to-mermaid/compare/dc2mermaid-core-v0.1.0...dc2mermaid-core-v0.2.0) (2026-03-14)


### Features

* complete MVP implementation — renderers, CLI, tests, CI, and docs ([6ccc93c](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/6ccc93ceb10a55fd5867e425b86399aad7592a6e))
* **core:** add depends_on inference strategy ([f26ed73](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/f26ed73c8ea60f6cf06c384863e2f0e1a2f9ffff))
* **core:** add environment variable URL inference strategy ([ec9c5b7](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/ec9c5b743c854205fd78395bfc93b45e059e3219))
* **core:** add error formatter, exit codes, and DiagnosticCollector ([70ce3de](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/70ce3de3849c1ed1450faf4817e10ac5cfaf66bb))
* **core:** add error formatter, exit codes, and DiagnosticCollector ([c42e2cc](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/c42e2cc6825ab916012705b2612a7d66e2fd2948))
* **core:** add image-based NodeType inference strategy ([cfff160](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/cfff16029841e6e413b876ad1643693ca3fef536))
* **core:** add legacy links inference strategy ([51c6c1b](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/51c6c1b31169d1f113d5b128411042294a04ccbc))
* **core:** add port annotation inference strategy ([5043643](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/5043643e9b77c2deb5ab078f7d2f9cef9ed7c9d2))
* **core:** add TypeScript interfaces and IR types ([88d6835](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/88d6835e078ea011313d7a89ed1b47514ad470af))
* **core:** add Zod schema and validator for Docker Compose spec ([fa0cde7](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/fa0cde7f86a7dd76f66ea11eaca3bf81c543098f))
* **core:** compose all inference strategies with edge deduplication ([50bdf5a](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/50bdf5afa40dc24e739de5183de10ff8e4b1e11a))
* **core:** define programmatic API surface (generate, parse, analyze, render, toJSON) ([d2da388](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/d2da388bb66eaf96151a247f94fb7217dbf08422))
* **core:** implement Compose file merger (base + overrides deep-merge) ([620ce4f](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/620ce4fa731301417419277107a14b758498edf3))
* **core:** implement config file support (.dc2mermaid.yml) ([f32c6b9](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/f32c6b9afaedb54f3603bf3deca13987c82118e7))
* **core:** implement YAML file loader and reader ([c6e3b38](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/c6e3b381e0ad5c8879dbc8227dd0ad6a4f2db304))
* prepare all distribution channels for release ([#47](https://github.com/TamirTapiro/docker-compose-to-mermaid/issues/47)) ([4583140](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/4583140bac1dc63aa6bd9ead02bba408fbaaf524))


### Bug Fixes

* **core:** rename @dc2mermaid/core to dc2mermaid-core ([#50](https://github.com/TamirTapiro/docker-compose-to-mermaid/issues/50)) ([f187c05](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/f187c05daab078416d0fdf70af30ba9283245881))
* **core:** resolve normalizer TypeScript strict mode errors ([b3e362f](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/b3e362fd8df4288064ee98963e02b69ff5ae9677))

## [0.1.0](https://github.com/TamirTapiro/docker-compose-to-mermaid/compare/core-v0.0.1...core-v0.1.0) (2026-03-14)


### Features

* complete MVP implementation — renderers, CLI, tests, CI, and docs ([6ccc93c](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/6ccc93ceb10a55fd5867e425b86399aad7592a6e))
* **core:** add depends_on inference strategy ([f26ed73](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/f26ed73c8ea60f6cf06c384863e2f0e1a2f9ffff))
* **core:** add environment variable URL inference strategy ([ec9c5b7](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/ec9c5b743c854205fd78395bfc93b45e059e3219))
* **core:** add error formatter, exit codes, and DiagnosticCollector ([70ce3de](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/70ce3de3849c1ed1450faf4817e10ac5cfaf66bb))
* **core:** add error formatter, exit codes, and DiagnosticCollector ([c42e2cc](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/c42e2cc6825ab916012705b2612a7d66e2fd2948))
* **core:** add image-based NodeType inference strategy ([cfff160](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/cfff16029841e6e413b876ad1643693ca3fef536))
* **core:** add legacy links inference strategy ([51c6c1b](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/51c6c1b31169d1f113d5b128411042294a04ccbc))
* **core:** add port annotation inference strategy ([5043643](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/5043643e9b77c2deb5ab078f7d2f9cef9ed7c9d2))
* **core:** add TypeScript interfaces and IR types ([88d6835](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/88d6835e078ea011313d7a89ed1b47514ad470af))
* **core:** add Zod schema and validator for Docker Compose spec ([fa0cde7](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/fa0cde7f86a7dd76f66ea11eaca3bf81c543098f))
* **core:** compose all inference strategies with edge deduplication ([50bdf5a](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/50bdf5afa40dc24e739de5183de10ff8e4b1e11a))
* **core:** define programmatic API surface (generate, parse, analyze, render, toJSON) ([d2da388](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/d2da388bb66eaf96151a247f94fb7217dbf08422))
* **core:** implement Compose file merger (base + overrides deep-merge) ([620ce4f](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/620ce4fa731301417419277107a14b758498edf3))
* **core:** implement config file support (.dc2mermaid.yml) ([f32c6b9](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/f32c6b9afaedb54f3603bf3deca13987c82118e7))
* **core:** implement YAML file loader and reader ([c6e3b38](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/c6e3b381e0ad5c8879dbc8227dd0ad6a4f2db304))
* prepare all distribution channels for release ([#47](https://github.com/TamirTapiro/docker-compose-to-mermaid/issues/47)) ([4583140](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/4583140bac1dc63aa6bd9ead02bba408fbaaf524))


### Bug Fixes

* **core:** resolve normalizer TypeScript strict mode errors ([b3e362f](https://github.com/TamirTapiro/docker-compose-to-mermaid/commit/b3e362fd8df4288064ee98963e02b69ff5ae9677))
