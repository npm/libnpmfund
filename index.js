'use strict'

const URL = require('url').URL
const Arborist = require('@npmcli/arborist')

// supports object funding and string shorthand, or an array of these
// if original was an array, returns an array; else returns the lone item
function normalizeFunding (funding) {
  const normalizeItem = item =>
    typeof item === 'string' ? { url: item } : item
  const sources = [].concat(funding || []).map(normalizeItem)
  return Array.isArray(funding) ? sources : sources[0]
}

// Is the value of a `funding` property of a `package.json`
// a valid type+url for `npm fund` to display?
function isValidFunding (funding) {
  if (!funding) return false

  if (Array.isArray(funding)) {
    return funding.every(f => !Array.isArray(f) && isValidFunding(f))
  }

  try {
    var parsed = new URL(funding.url || funding)
  } catch (error) {
    return false
  }

  if (
    parsed.protocol !== 'https:' &&
    parsed.protocol !== 'http:'
  ) return false

  return Boolean(parsed.host)
}

const empty = () => Object.create(null)

// retrieves funding info for project at cwd or given opts.idealTree if avail
async function read (opts) {
  let packageWithFundingCount = 0
  const seen = new Set()
  const { countOnly, path, tree, ...arbOpts } = opts || {}
  let idealTree = tree
  const _trailingDependencies = Symbol('trailingDependencies')

  if (!tree) {
    const arb = new Arborist({ ...arbOpts, path })
    idealTree = await arb.loadActual()
  }

  function tracked (name, version) {
    const key = String(name) + String(version)
    if (seen.has(key)) {
      return true
    }
    seen.add(key)
  }

  function retrieveDependencies (dependencies) {
    const trailing = dependencies[_trailingDependencies]

    if (trailing) {
      return Object.assign(
        empty(),
        dependencies,
        trailing
      )
    }

    return dependencies
  }

  function hasDependencies (dependencies) {
    return dependencies && (
      Object.keys(dependencies).length ||
      dependencies[_trailingDependencies]
    )
  }

  function attachFundingInfo (target, funding) {
    if (funding && isValidFunding(funding)) {
      target.funding = normalizeFunding(funding)
      packageWithFundingCount++
    }
  }

  function getFundingDependencies (tree) {
    const edges = tree && tree.edgesOut && tree.edgesOut.values()
    if (!edges) return empty()

    const directDepsWithFunding = Array.from(edges).map(edge => {
      if (!edge || !edge.to) return empty()

      const node = edge.to.target || edge.to
      if (!node.package) return empty()

      const { name, funding, version } = node.package

      // avoids duplicated items within the funding tree
      if (tracked(name, version)) return empty()

      const fundingItem = {}

      if (version) {
        fundingItem.version = version
      }

      attachFundingInfo(fundingItem, funding)

      return {
        node,
        fundingItem
      }
    })

    return directDepsWithFunding.reduce(
      (res, { node, fundingItem }, i) => {
        if (!fundingItem ||
          fundingItem.length === 0 ||
          !node) return res

        // recurse
        const transitiveDependencies = node.edgesOut &&
          node.edgesOut.size > 0 &&
          getFundingDependencies(node)

        // if we're only counting items there's no need
        // to add all the data to the resulting object
        if (countOnly) return null

        if (hasDependencies(transitiveDependencies)) {
          fundingItem.dependencies =
            retrieveDependencies(transitiveDependencies)
        }

        if (isValidFunding(fundingItem.funding)) {
          res[node.package.name] = fundingItem
        } else if (hasDependencies(fundingItem.dependencies)) {
          res[_trailingDependencies] =
            Object.assign(
              empty(),
              res[_trailingDependencies],
              fundingItem.dependencies
            )
        }

        return res
      }, countOnly ? null : empty())
  }

  const idealTreeDependencies = getFundingDependencies(idealTree)
  const result = {
    length: packageWithFundingCount
  }

  if (!countOnly) {
    const name =
      (idealTree && idealTree.package && idealTree.package.name) ||
      (idealTree && idealTree.name)
    result.name = name || (idealTree && idealTree.path)

    if (idealTree && idealTree.package && idealTree.package.version) {
      result.version = idealTree.package.version
    }

    if (idealTree && idealTree.package && idealTree.package.funding) {
      result.funding = normalizeFunding(idealTree.package.funding)
    }

    result.dependencies = retrieveDependencies(idealTreeDependencies)
  }

  return result
}

module.exports = {
  read,
  normalizeFunding,
  isValidFunding
}
