'use strict'

const { test } = require('tap')
const {
  read,
  normalizeFunding,
  isValidFunding
} = require('./index.js')

test('empty tree', (t) => {
  t.deepEqual(
    read({}),
    {
      name: null,
      dependencies: {},
      length: 0
    },
    'should return empty list'
  )
  t.end()
})

test('single item missing funding', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      dependencies: {
        'single-item': {
          name: 'single-item',
          version: '1.0.0'
        }
      }
    }),
    {
      name: 'project',
      dependencies: {},
      length: 0
    },
    'should return empty list'
  )
  t.end()
})

test('funding object missing url', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      edgesOut: new Map([
        ['single-item', {
          name: 'single-item',
          version: '1.0.0',
          funding: {
            type: 'Foo'
          }
        }]
      ])
    }),
    {
      name: 'project',
      dependencies: {},
      length: 0
    },
    'should return empty list'
  )
  t.end()
})

test('use path if name is missing', (t) => {
  t.deepEqual(
    read({
      name: undefined,
      path: '/tmp/foo'
    }),
    {
      name: '/tmp/foo',
      dependencies: {},
      length: 0
    },
    'should use path as top level name'
  )
  t.end()
})

test('single item tree', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      edgesOut: new Map([
        ['single-item', {
          to: {
            name: 'single-item',
            package: {
              name: 'single-item',
              version: '1.0.0',
              funding: {
                type: 'foo',
                url: 'http://example.com'
              }
            }
          }
        }]
      ])
    }),
    {
      name: 'project',
      dependencies: {
        'single-item': {
          version: '1.0.0',
          funding: {
            type: 'foo',
            url: 'http://example.com'
          }
        }
      },
      length: 1
    },
    'should return list with a single item'
  )
  t.end()
})

test('multiple funding sources', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      edgesOut: new Map([
        ['single-item', {
          to: {
            name: 'single-item',
            package: {
              name: 'single-item',
              version: '1.0.0',
              funding: [
                {
                  type: 'foo',
                  url: 'http://example.com/foo'
                },
                {
                  type: 'bar',
                  url: 'http://example.com/bar'
                }
              ]
            }
          }
        }]
      ])
    }),
    {
      name: 'project',
      dependencies: {
        'single-item': {
          version: '1.0.0',
          funding: [
            {
              type: 'foo',
              url: 'http://example.com/foo'
            },
            {
              type: 'bar',
              url: 'http://example.com/bar'
            }
          ]
        }
      },
      length: 1
    },
    'should return list with a single item containing multiple funding sources'
  )
  t.end()
})

test('deep-nested missing funding-info obj', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      package: {
        funding: 'http://example.com'
      },
      edgesOut: new Map([
        ['no-funding-info-item', {
          to: {
            name: 'no-funding-info-item',
            package: {
              name: 'no-funding-info-item',
              version: '1.0.0'
            },
            edgesOut: new Map([
              ['single-item', {
                to: {
                  name: 'single-item',
                  package: {
                    name: 'single-item',
                    version: '1.0.0'
                  }
                }
              }]
            ])
          }
        }]
      ])
    }),
    {
      name: 'project',
      funding: {
        url: 'http://example.com'
      },
      dependencies: {},
      length: 0
    },
    'should return list excluding packages missing funding info'
  )
  t.end()
})

test('top-level funding info', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      package: {
        funding: 'http://example.com'
      }
    }),
    {
      name: 'project',
      funding: {
        url: 'http://example.com'
      },
      dependencies: {},
      length: 0
    },
    'should return top-level item with normalized funding info'
  )
  t.end()
})

test('use string shorthand', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      edgesOut: new Map([
        ['single-item', {
          to: {
            name: 'single-item',
            package: {
              name: 'single-item',
              version: '1.0.0',
              funding: 'http://example.com'
            }
          }
        }]
      ])
    }),
    {
      name: 'project',
      dependencies: {
        'single-item': {
          version: '1.0.0',
          funding: {
            url: 'http://example.com'
          }
        }
      },
      length: 1
    },
    'should return item with normalized funding info'
  )
  t.end()
})

test('duplicate items along the tree', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      package: {
        version: '2.3.4'
      },
      edgesOut: new Map([
        ['single-item', {
          to: {
            name: 'single-item',
            package: {
              name: 'single-item',
              version: '1.0.0',
              funding: {
                type: 'foo',
                url: 'https://example.com'
              }
            },
            edgesOut: new Map([
              ['shared-top-first', {
                to: {
                  name: 'shared-top-first',
                  package: {
                    name: 'shared-top-first',
                    version: '1.0.0',
                    funding: {
                      type: 'foo',
                      url: 'https://example.com'
                    }
                  }
                }
              }],
              ['sub-dep', {
                to: {
                  name: 'sub-dep',
                  package: {
                    name: 'sub-dep',
                    version: '1.0.0',
                    funding: {
                      type: 'foo',
                      url: 'https://example.com'
                    }
                  },
                  edgesOut: new Map([
                    ['shared-nested-first', {
                      to: {
                        name: 'shared-nested-first',
                        package: {
                          name: 'shared-nested-first',
                          version: '1.0.0',
                          funding: {
                            type: 'foo',
                            url: 'https://example.com'
                          }
                        },
                        edgesOut: new Map([
                          ['shared-top-first', {
                            to: {
                              name: 'shared-top-first',
                              package: {
                                name: 'shared-top-first',
                                version: '1.0.0',
                                funding: {
                                  type: 'foo',
                                  url: 'https://example.com'
                                }
                              }
                            }
                          }]
                        ])
                      }
                    }]
                  ])
                }
              }],
              ['shared-nested-first', {
                to: {
                  name: 'shared-nested-first',
                  package: {
                    name: 'shared-nested-first',
                    version: '1.0.0',
                    funding: {
                      type: 'foo',
                      url: 'https://example.com'
                    }
                  }
                }
              }]
            ])
          }
        }]
      ])
    }),
    {
      name: 'project',
      version: '2.3.4',
      dependencies: {
        'single-item': {
          version: '1.0.0',
          funding: {
            type: 'foo',
            url: 'https://example.com'
          },
          dependencies: {
            'shared-top-first': {
              version: '1.0.0',
              funding: {
                type: 'foo',
                url: 'https://example.com'
              }
            },
            'sub-dep': {
              version: '1.0.0',
              funding: {
                type: 'foo',
                url: 'https://example.com'
              }
            },
            'shared-nested-first': {
              version: '1.0.0',
              funding: {
                type: 'foo',
                url: 'https://example.com'
              }
            }
          }
        }
      },
      length: 4
    },
    'should return list with a single item'
  )
  t.end()
})

test('multi-level nested items tree', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      edgesOut: new Map([
        ['first-level-dep', {
          to: {
            name: 'first-level-dep',
            package: {
              name: 'first-level-dep',
              version: '1.0.0',
              funding: {
                type: 'foo',
                url: 'https://example.com'
              }
            },
            edgesOut: new Map([
              ['sub-dep', {
                to: {
                  name: 'sub-dep',
                  package: {
                    name: 'sub-dep',
                    version: '1.0.0',
                    funding: {
                      type: 'foo',
                      url: 'https://example.com'
                    }
                  },
                  edgesOut: new Map([
                    ['sub-sub-dep', {
                      to: {
                        name: 'sub-sub-dep',
                        package: {
                          name: 'sub-sub-dep',
                          version: '1.0.0',
                          funding: {
                            type: 'foo',
                            url: 'https://example.com'
                          }
                        },
                        edgesOut: new Map()
                      }
                    }]
                  ])
                }
              }]
            ])
          }
        }]
      ])
    }),
    {
      name: 'project',
      dependencies: {
        'first-level-dep': {
          version: '1.0.0',
          funding: {
            type: 'foo',
            url: 'https://example.com'
          },
          dependencies: {
            'sub-dep': {
              version: '1.0.0',
              funding: {
                type: 'foo',
                url: 'https://example.com'
              },
              dependencies: {
                'sub-sub-dep': {
                  version: '1.0.0',
                  funding: {
                    type: 'foo',
                    url: 'https://example.com'
                  }
                }
              }
            }
          }
        }
      },
      length: 3
    },
    'should return list with all items'
  )
  t.end()
})

test('missing fund nested items tree', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      edgesOut: new Map([
        ['first-level-dep', {
          to: {
            name: 'first-level-dep',
            package: {
              name: 'first-level-dep',
              version: '1.0.0',
              funding: {
                type: 'foo'
              }
            },
            edgesOut: new Map([
              ['sub-dep', {
                to: {
                  name: 'sub-dep',
                  package: {
                    name: 'sub-dep',
                    version: '1.0.0'
                  },
                  edgesOut: new Map([
                    ['sub-sub-dep-01', {
                      to: {
                        name: 'sub-sub-dep-01',
                        package: {
                          name: 'sub-sub-dep-01',
                          version: '1.0.0',
                          funding: {
                            type: 'foo',
                            url: 'https://example.com'
                          }
                        },
                        edgesOut: new Map([
                          ['non-funding-child', {
                            to: {
                              name: 'non-funding-child',
                              package: {
                                name: 'non-funding-child',
                                version: '1.0.0'
                              },
                              edgesOut: new Map([
                                ['sub-sub-sub-dep', {
                                  to: {
                                    name: 'sub-sub-sub-dep',
                                    package: {
                                      name: 'sub-sub-sub-dep',
                                      version: '1.0.0',
                                      funding: {
                                        type: 'foo',
                                        url: 'https://example.com'
                                      }
                                    }
                                  }
                                }]
                              ])
                            }
                          }]
                        ])
                      }
                    }],
                    ['sub-sub-dep-02', {
                      to: {
                        name: 'sub-sub-dep-02',
                        package: {
                          name: 'sub-sub-dep-02',
                          version: '1.0.0',
                          funding: {
                            type: 'foo',
                            url: 'https://example.com'
                          }
                        },
                        edgesOut: new Map()
                      }
                    }],
                    ['sub-sub-dep-03', {
                      to: {
                        name: 'sub-sub-dep-03',
                        package: {
                          name: 'sub-sub-dep-03',
                          version: '1.0.0',
                          funding: {
                            type: 'foo',
                            url: 'git://example.git'
                          }
                        },
                        edgesOut: new Map([
                          ['sub-sub-sub-dep-03', {
                            to: {
                              name: 'sub-sub-sub-dep-03',
                              package: {
                                name: 'sub-sub-sub-dep-03',
                                version: '1.0.0'
                              },
                              edgesOut: new Map([
                                ['sub-sub-sub-sub-dep', {
                                  to: {
                                    name: 'sub-sub-sub-sub-dep',
                                    package: {
                                      name: 'sub-sub-sub-sub-dep',
                                      version: '1.0.0',
                                      funding: {
                                        type: 'foo',
                                        url: 'http://example.com'
                                      }
                                    }
                                  }
                                }]
                              ])
                            }
                          }]
                        ])
                      }
                    }]
                  ])
                }
              }]
            ])
          }
        }]
      ])
    }),
    {
      name: 'project',
      dependencies: {
        'sub-sub-dep-01': {
          version: '1.0.0',
          funding: {
            type: 'foo',
            url: 'https://example.com'
          },
          dependencies: {
            'sub-sub-sub-dep': {
              version: '1.0.0',
              funding: {
                type: 'foo',
                url: 'https://example.com'
              }
            }
          }
        },
        'sub-sub-dep-02': {
          version: '1.0.0',
          funding: {
            type: 'foo',
            url: 'https://example.com'
          }
        },
        'sub-sub-sub-sub-dep': {
          version: '1.0.0',
          funding: {
            type: 'foo',
            url: 'http://example.com'
          }
        }
      },
      length: 4
    },
    'should return list excluding missing funding items'
  )
  t.end()
})

test('countOnly option', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      edgesOut: new Map([
        ['first-level-dep', {
          to: {
            name: 'first-level-dep',
            package: {
              name: 'first-level-dep',
              version: '1.0.0',
              funding: {
                type: 'foo'
              }
            },
            edgesOut: new Map([
              ['sub-dep', {
                to: {
                  name: 'sub-dep',
                  package: {
                    name: 'sub-dep',
                    version: '1.0.0',
                    funding: {
                      type: 'foo',
                      url: 'https://example.com'
                    }
                  },
                  edgesOut: new Map([
                    ['sub-sub-dep', {
                      to: {
                        name: 'sub-sub-dep',
                        package: {
                          name: 'sub-sub-dep',
                          version: '1.0.0',
                          funding: {
                            type: 'foo',
                            url: 'https://example.com'
                          }
                        },
                        edgesOut: new Map()
                      }
                    }]
                  ])
                }
              }],
              ['sub-sub-dep', {
                to: {
                  name: 'sub-sub-dep',
                  package: {
                    name: 'sub-sub-dep',
                    version: '1.0.0',
                    funding: {
                      type: 'foo',
                      url: 'https://example.com'
                    }
                  }
                }
              }]
            ])
          }
        }]
      ])
    }, { countOnly: true }),
    {
      length: 2
    },
    'should return only the length property'
  )
  t.end()
})

test('handle different versions', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      edgesOut: new Map([
        ['foo', {
          to: {
            name: 'foo',
            package: {
              name: 'foo',
              version: '1.0.0',
              funding: {
                type: 'foo',
                url: 'https://example.com'
              }
            },
            edgesOut: new Map([
              ['bar', {
                to: {
                  name: 'bar',
                  package: {
                    name: 'bar',
                    version: '1.0.0',
                    funding: {
                      type: 'foo',
                      url: 'https://example.com'
                    }
                  }
                }
              }]
            ])
          }
        }],
        ['lorem', {
          to: {
            name: 'lorem',
            package: {
              name: 'lorem'
            },
            edgesOut: new Map([
              ['foo', {
                to: {
                  name: 'foo',
                  package: {
                    name: 'foo',
                    version: '2.0.0',
                    funding: {
                      type: 'foo',
                      url: 'https://example.com'
                    }
                  },
                  edgesOut: new Map([
                    ['foo-bar', {
                      to: {
                        name: 'foo-bar',
                        package: {
                          name: 'foo-bar',
                          version: '1.0.0',
                          funding: {
                            type: 'foo',
                            url: 'https://example.com'
                          }
                        }
                      }
                    }]
                  ])
                }
              }]
            ])
          }
        }]
      ])
    }, { countOnly: true }),
    {
      length: 4
    },
    'should treat different versions as diff packages'
  )
  t.end()
})

test('should not count root', (t) => {
  t.deepEqual(
    read({
      name: 'project',
      package: {
        funding: 'http://example.com'
      },
      edgesOut: new Map()
    }, { countOnly: true }),
    {
      length: 0
    },
    'should return length value excluding root funding info'
  )
  t.end()
})

test('retrieve funding info from valid objects', (t) => {
  t.deepEqual(
    normalizeFunding({
      url: 'http://example.com',
      type: 'Foo'
    }),
    {
      url: 'http://example.com',
      type: 'Foo'
    },
    'should return standard object fields'
  )
  t.deepEqual(
    normalizeFunding({
      extra: 'Foo',
      url: 'http://example.com',
      type: 'Foo'
    }),
    {
      extra: 'Foo',
      url: 'http://example.com',
      type: 'Foo'
    },
    'should leave untouched extra fields'
  )
  t.deepEqual(
    normalizeFunding({
      url: 'http://example.com'
    }),
    {
      url: 'http://example.com'
    },
    'should accept url-only objects'
  )
  t.end()
})

test('retrieve funding info from invalid objects', (t) => {
  t.deepEqual(
    normalizeFunding({}),
    {},
    'should passthrough empty objects'
  )
  t.deepEqual(
    normalizeFunding(),
    undefined,
    'should not care about undefined'
  )
  t.deepEqual(
    normalizeFunding(),
    null,
    'should not care about null'
  )
  t.end()
})

test('retrieve funding info string shorthand', (t) => {
  t.deepEqual(
    normalizeFunding('http://example.com'),
    {
      url: 'http://example.com'
    },
    'should accept string shorthand'
  )
  t.end()
})

test('retrieve funding info from an array', (t) => {
  t.deepEqual(
    normalizeFunding([
      'http://example.com',
      {
        url: 'http://two.example.com'
      },
      'http://three.example.com',
      {
        url: 'http://three.example.com',
        type: 'dos'
      },
      {
        url: 'http://three.example.com',
        type: 'third copy!',
        extra: 'extra metadata!'
      }
    ]),
    [
      {
        url: 'http://example.com'
      },
      {
        url: 'http://two.example.com'
      },
      {
        url: 'http://three.example.com'
      },
      {
        url: 'http://three.example.com',
        type: 'dos'
      },
      {
        url: 'http://three.example.com',
        type: 'third copy!',
        extra: 'extra metadata!'
      }
    ],
    'should accept and normalize multiple funding sources'
  )
  t.end()
})

test('valid funding objects', (t) => {
  t.ok(
    isValidFunding({ url: 'http://example.com' }),
    'should return true for url-only valid obj'
  )
  t.ok(
    isValidFunding('http://example.com'),
    'should return true for valid string'
  )
  t.ok(
    isValidFunding({ type: 'foo', url: 'https://example.com' }),
    'should return true for url+type valid obj'
  )
  t.ok(
    isValidFunding([
      'https://example.com',
      { url: 'https://example.com/2' },
      { type: 'foo', url: 'https://example.com/1' }
    ]),
    'should return true if array contain ALL valid items'
  )
  t.end()
})

test('invalid funding objects', (t) => {
  t.notOk(
    isValidFunding({ url: 'ftp://example.com' }),
    'should return false if using invalid url'
  )
  t.notOk(
    isValidFunding({}),
    'should return false if using empty object'
  )
  t.notOk(
    isValidFunding(''),
    'should return false if using empty string'
  )
  t.notOk(
    isValidFunding(0),
    'should return false if using 0'
  )
  t.notOk(
    isValidFunding(100),
    'should return false if using number'
  )
  t.notOk(
    isValidFunding(/foo/g),
    'should return false if using invalid obj'
  )
  t.notOk(
    isValidFunding({ foo: 'not a valid funding obj' }),
    'should return false if using not valid obj'
  )
  t.notOk(
    isValidFunding([
      { url: 'https://example.com/2' },
      0
    ]),
    'should return false if ANY of array items is invalid'
  )
  t.end()
})
