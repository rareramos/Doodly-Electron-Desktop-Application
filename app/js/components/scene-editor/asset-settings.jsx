import React from 'react';
import PropTypes from 'prop-types';
import Modal from '../common/modal.jsx';
import ColorPicker from '../common/color-picker.jsx';
import TimeInput from '../common/time-input.jsx';

// color picker requires the following changes
// -- remove alpha component from SketchPicker
// -- SketchInputFields: set dragLabel to false

class AssetSettings extends React.Component {
  static propTypes = {
    assets: PropTypes.array.isRequired,
  }

  state = {
    color: '#000000',
    entryAnimation: 'draw',
    entryAnimationDuration: 3000,
    exitAnimation: 'none',
    exitAnimationDuration: 0
  }

  render() {
    return (
      <Modal ref="assetModal" className="asset-settings" title="Asset settings" blocksInteraction={true}>
        <div className="group settings flex center">
          <label>Color:</label>&nbsp;&nbsp;
          <ColorPicker color={this.state.color} onChange={this.handleColorChange} />
        </div>
        {this.props.assets.length === 1 && (
          <div className="group settings flex center space-between">
            <div style={{ width: '45%' }}>
              <label>Enter Animation:</label>
              <div className="pretty-select" style={{ marginBottom: 5 }}>
                <select ref="entryAnimation" onChange={this.handleEntryAnimationChange}>
                  <option value="none">None</option>
                  <option value="draw">Draw</option>
                </select>
              </div>
              <TimeInput value={this.state.entryAnimationDuration} onUpdate={this.handleEntryAnimationDurationChange.bind(this)} />
            </div>
            <div style={{ width: '45%' }}>
              <label>Exit Animation:</label>
              <div className="pretty-select" style={{ marginBottom: 5 }}>
                <select ref="exitAnimation" onChange={this.handleExitAnimationChange}>
                  <option value="none">None</option>
                  <option value="erase">Erase</option>
                </select>
              </div>
              <TimeInput value={this.state.exitAnimationDuration} onUpdate={this.handleExitAnimationDurationChange.bind(this)} />
            </div>
          </div>
        )}
        <div className="group flex space-around">
          <button className="btn lg success" onClick={this.apply}>Apply</button>
        </div>
      </Modal>
    )
  }

  componentDidMount() {
    this.setup();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props != prevProps)
      this.setup();
  }

  show = () => {
    this.refs.assetModal.show();
  }

  setup = () => {
    if (this.props.assets.length === 1) {
      const asset = this.props.assets[0];
      this.setState({
        color: asset.color ,
        entryAnimation: asset.entryAnimation,
        entryAnimationDuration: asset.animationDuration,
        exitAnimation: asset.exitAnimation,
        exitAnimationDuration: asset.exitAnimationDuration
      });

      this.refs.exitAnimation.value = asset.exitAnimation;
      this.refs.entryAnimation.value = asset.entryAnimation;
    }
  }

  handleColorChange = (color) => {
    this.setState({color: color});
  }

  handleEntryAnimationChange = () => {
    let value = this.refs.entryAnimation.value;
    this.setState({
      entryAnimation: value,
      entryAnimationDuration: value == 'none' ? 0 : (this.state.animationDuration || this.props.assets[0].animationDuration || 3000)
    });
  }

  handleEntryAnimationDurationChange = (time) => {
    this.setState({entryAnimationDuration: (this.state.entryAnimation != 'none' ? time : 0)});
  }

  handleExitAnimationChange = () => {
    let value = this.refs.exitAnimation.value;
    this.setState({
      exitAnimation: value,
      exitAnimationDuration: value == 'none' ? 0 : (this.state.exitAnimationDuration || this.props.assets[0].exitAnimationDuration || 3000)
    });
  }

  handleExitAnimationDurationChange = (time) => {
    this.setState({exitAnimationDuration: (this.state.exitAnimation != 'none' ? time : 0)});
  }

  apply = () => {
    if(this.props.assets.length === 1){
      this.props.assets[0].color = this.state.color;
      this.props.assets[0].entryAnimation = this.state.entryAnimation;
      this.props.assets[0].animationDuration = this.state.entryAnimationDuration;
      this.props.assets[0].exitAnimation = this.state.exitAnimation;
      this.props.assets[0].exitAnimationDuration = this.state.exitAnimationDuration;
    }else {
      this.props.assets.forEach(as=>{
        as.color = this.state.color;
      });
    }
    this.props.onChange && this.props.onChange();
    this.refs.assetModal.hide();
  }

}

export default AssetSettings;
