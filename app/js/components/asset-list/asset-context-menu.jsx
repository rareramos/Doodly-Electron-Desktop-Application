import React from 'react'
import PropTypes from 'prop-types'
import ContextMenu, { MenuItem } from '../common/context-menu.jsx'

class AssetContextMenu extends React.Component {
  static propTypes = {
    actionListener: PropTypes.func.isRequired
  }

  state = {
    assetID: -1,
    x: 0,
    y: 0
  }

  render() {
    let { assetID, ...props } = this.state;
    return (
      <ContextMenu ref="menu" {...props}>
        <MenuItem title="Delete Asset" onClick={this.delete}/>
      </ContextMenu>
    )
  }

  show = (assetID, x, y) => {
    this.setState({
      assetID: assetID,
      x: x - 10,
      y: y - 10,
    })
    this.refs.menu.show();
  }

  delete = (e) => {
    e.stopPropagation();
    this.props.actionListener({
      action: 'delete_asset',
      data: {
        assetID: this.state.assetID
      }
    })
  }

}

export default AssetContextMenu
