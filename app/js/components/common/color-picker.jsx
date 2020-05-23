import React from 'react'
import PropTypes from 'prop-types'
import { SketchPicker } from 'react-color'

class ColorPicker extends React.Component {
  state = {
    color: {
      r: 0,
      g: 0,
      b: 0,
      a: 1
    },
    displayColorPicker: false
  }

  componentDidMount() {
    this.setup();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props != prevProps)
      this.setup();
  }

  setup = () => {
    if (!this.props.color) {
      this.setState({
        color: {
          r: 0,
          g: 0,
          b: 0,
          a: 0
        }
      })
      return;
    }
    let rgbColor = hexToRgb(this.props.color)
    this.setState({
      color: {
        r: rgbColor.r,
        g: rgbColor.g,
        b: rgbColor.b,
        a: 1
      }
    })
  }

  togglePicker = () => {
    this.setState({ displayColorPicker: !this.state.displayColorPicker });
  }

  handleChange = (color) => {
    if (color) {
      this.setState({color: color.rgb});
      this.props.onChange && this.props.onChange(color.hex);
    } else {
      this.setState({color: {
        r: 0,
        g: 0,
        b: 0,
        a: 0
      }});
      this.props.onChange && this.props.onChange();
    }
  }

  render () {
    let styles = {
      color: {
        width: '36px',
        height: '14px',
        borderRadius: '2px',
        background: `rgba(${ this.state.color.r }, ${ this.state.color.g }, ${ this.state.color.b }, 1)`,
      },
      swatch: {
        padding: '5px',
        background: '#fff',
        borderRadius: '1px',
        boxShadow: '0 0 0 1px rgba(0,0,0,.1)',
        display: 'inline-block',
        cursor: 'pointer',
      },
      popover: {
        position: 'absolute',
        zIndex: '2',
      },
      cover: {
        position: 'fixed',
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
      },
      reset: {
        display: (this.state.color.r != 0 || this.state.color.g != 0 || this.state.color.b != 0) ? 'block' : 'none',
        color: '#993333',
      }
    }

    return (
      <div>
        <div className="flex center">
          <div style={ styles.swatch } onClick={ this.togglePicker }>
            <div style={ styles.color } />
          </div>
          <button className="btn clear xs" onClick={this.handleChange.bind(this, null)}><i className="fa fa-ban" style={styles.reset}/></button>
        </div>
        {
          this.state.displayColorPicker &&
          <div style={ styles.popover }>
            <div style={ styles.cover } onClick={ this.togglePicker }/>
            <SketchPicker color={this.state.color} disableAlpha={true} onChange={this.handleChange}/>
          </div>
        }
      </div>
    )
  }
}

function hexToRgb(hex) {
  var hex = hex.replace('#', '');
  var r = parseInt(hex.substring(0, 2), 16) || 0;
  var g = parseInt(hex.substring(2, 4), 16) || 0;
  var b = parseInt(hex.substring(4, 6), 16) || 0;

  return {r, g, b}
}

export default ColorPicker;
